// --- 3D Room Designer Pro Core Application ---

let scene, camera, renderer, controls;
let roomWidth = 5, roomLength = 5, roomHeight = 3;
let floorMesh, wallsGroup;
let objectsInRoom = [];
let selectedObject = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isDragging = false;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let currentDragObject = null;

// โหมดเดินชม (First Person / Walk mode)
let isWalkMode = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();

// เริ่มต้นระบบเมื่อโหลดหน้าเว็บ
init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121212);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(6, 6, 8);

    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // ไม่ให้กล้องทะลุใต้พื้น

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // สร้างห้องเริ่มต้น
    buildRoom();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    setupUIEventListeners();
    setupDragAndDrop();
}

// สร้างพื้นและผนังห้อง
function buildRoom() {
    if (floorMesh) scene.remove(floorMesh);
    if (wallsGroup) scene.remove(wallsGroup);

    const floorColor = document.getElementById('room-floor-color').value;
    const wallColor = document.getElementById('room-wall-color').value;

    // พื้นห้อง
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorMesh.name = "Floor";
    scene.add(floorMesh);

    // ผนังห้อง
    wallsGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, side: THREE.DoubleSide });

    const wallThickness = 0.1;
    
    // ผนังหลัง (Back)
    const backWallGeo = new THREE.BoxGeometry(roomWidth, roomHeight, wallThickness);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, roomHeight / 2, -roomLength / 2);
    backWall.receiveShadow = true;
    wallsGroup.add(backWall);

    // ผนังซ้าย (Left)
    const leftWallGeo = new THREE.BoxGeometry(wallThickness, roomHeight, roomLength);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    leftWall.receiveShadow = true;
    wallsGroup.add(leftWall);

    scene.add(wallsGroup);
}

// สร้างโมเดลเฟอร์นิเจอร์ตามประเภท
function createFurniture(type, data = {}) {
    let group = new THREE.Group();
    let mesh;
    let defaultColor = data.color || '#ffffff';
    let w = data.w || 1, h = data.h || 1, d = data.d || 1;

    const mat = new THREE.MeshStandardMaterial({ color: defaultColor, roughness: 0.5 });

    switch (type) {
        case 'bed':
            w = data.w || 1.6; h = data.h || 0.6; d = data.d || 2.0;
            const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), mat);
            base.position.y = (h * 0.7) / 2;
            const headboard = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), mat);
            headboard.position.set(0, h / 2, -d / 2 + 0.05);
            group.add(base, headboard);
            break;

        case 'desk':
            w = data.w || 1.4; h = data.h || 0.75; d = data.d || 0.7;
            const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat);
            top.position.y = h - 0.025;
            const legGeo = new THREE.BoxGeometry(0.08, h, 0.08);
            const leg1 = new THREE.Mesh(legGeo, mat); leg1.position.set(-w/2 + 0.1, h/2, -d/2 + 0.1);
            const leg2 = new THREE.Mesh(legGeo, mat); leg2.position.set(w/2 - 0.1, h/2, -d/2 + 0.1);
            const leg3 = new THREE.Mesh(legGeo, mat); leg3.position.set(-w/2 + 0.1, h/2, d/2 - 0.1);
            const leg4 = new THREE.Mesh(legGeo, mat); leg4.position.set(w/2 - 0.1, h/2, d/2 - 0.1);
            group.add(top, leg1, leg2, leg3, leg4);
            break;

        case 'chair':
            w = data.w || 0.5; h = data.h || 0.9; d = data.d || 0.5;
            const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat);
            seat.position.y = 0.45;
            const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.05), mat);
            back.position.set(0, 0.45 + 0.225, -d/2 + 0.025);
            const chairLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), mat);
            chairLeg.position.set(-w/2+0.05, 0.225, -d/2+0.05);
            group.add(seat, back, chairLeg);
            break;

        case 'sofa':
            w = data.w || 2.0; h = data.h || 0.8; d = data.d || 0.9;
            const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat);
            sofaBase.position.y = 0.2;
            const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.2), mat);
            sofaBack.position.set(0, 0.6, -d/2 + 0.1);
            group.add(sofaBase, sofaBack);
            break;

        case 'wardrobe':
            w = data.w || 1.2; h = data.h || 2.0; d = data.d || 0.6;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = h / 2;
            group.add(mesh);
            break;

        case 'tv':
            w = data.w || 1.2; h = data.h || 0.7; d = data.d || 0.1;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = 1.2;
            group.add(mesh);
            break;

        case 'shelf':
            w = data.w || 1.0; h = data.h || 1.8; d = data.d || 0.4;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = h / 2;
            group.add(mesh);
            break;

        case 'lamp':
            w = data.w || 0.4; h = data.h || 1.5; d = data.d || 0.4;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h), mat);
            pole.position.y = h / 2;
            const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 16), mat);
            shade.position.y = h - 0.15;
            group.add(pole, shade);
            break;

        case 'rug':
            w = data.w || 2.5; h = data.h || 0.01; d = data.d || 2.0;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = 0.005;
            group.add(mesh);
            break;

        case 'plant':
            w = data.w || 0.4; h = data.h || 0.8; d = data.d || 0.4;
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4), mat);
            pot.position.y = 0.2;
            const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
            const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), leavesMat);
            leaves.position.y = 0.5;
            group.add(pot, leaves);
            break;

        case 'door':
            w = data.w || 0.9; h = data.h || 2.1; d = data.d || 0.1;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = h / 2;
            group.add(mesh);
            break;

        case 'window':
            w = data.w || 1.0; h = data.h || 1.2; d = data.d || 0.1;
            mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.y = 1.2;
            group.add(mesh);
            break;

        default:
            mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
            mesh.position.y = 0.5;
            group.add(mesh);
    }

    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    group.userData = {
        id: 'obj_' + Date.now() + Math.random().toString(36).substr(2, 5),
        type: type,
        name: getThaiName(type),
        color: defaultColor,
        width: w,
        height: h,
        depth: d
    };

    return group;
}

function getThaiName(type) {
    const names = {
        bed: 'เตียงนอน', desk: 'โต๊ะทำงาน', chair: 'เก้าอี้', sofa: 'โซฟา',
        wardrobe: 'ตู้เสื้อผ้า', tv: 'โทรทัศน์', shelf: 'ชั้นวางของ', lamp: 'โคมไฟ',
        rug: 'พรม', plant: 'ต้นไม้ตกแต่ง', door: 'ประตู', window: 'หน้าต่าง'
    };
    return names[type] || 'วัตถุ';
}

// UI Event Listeners & การควบคุม
function setupUIEventListeners() {
    // Tabs
    // ปรับขนาดวัตถุ (Width, Height, Depth)
    const updateObjectSize = () => {
        if (!selectedObject) return;
        const w = parseFloat(document.getElementById('prop-size-w').value) || selectedObject.userData.width;
        const h = parseFloat(document.getElementById('prop-size-h').value) || selectedObject.userData.height;
        const d = parseFloat(document.getElementById('prop-size-d').value) || selectedObject.userData.depth;
        
        selectedObject.userData.width = w;
        selectedObject.userData.height = h;
        selectedObject.userData.depth = d;

        // สร้างเรขาคณิตใหม่ตามขนาดที่ปรับ
        // หมายเหตุ: หากต้องการความสมบูรณ์ สามารถปรับ scale หรือ re-create mesh ของวัตถุที่เลือกได้ที่นี่
        selectedObject.scale.set(w / (selectedObject.userData.baseWidth || w), h / (selectedObject.userData.baseHeight || h), d / (selectedObject.userData.baseDepth || d));
    };

    document.getElementById('prop-size-w').addEventListener('input', updateObjectSize);
    document.getElementById('prop-size-h').addEventListener('input', updateObjectSize);
    document.getElementById('prop-size-d').addEventListener('input', updateObjectSize);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Room Size Controls
    const updateRoomSize = () => {
        roomWidth = parseFloat(document.getElementById('room-width').value);
        roomLength = parseFloat(document.getElementById('room-length').value);
        roomHeight = parseFloat(document.getElementById('room-height').value);

        document.getElementById('val-room-w').innerText = roomWidth;
        document.getElementById('val-room-l').innerText = roomLength;
        document.getElementById('val-room-h').innerText = roomHeight;

        buildRoom();
    };

    document.getElementById('room-width').addEventListener('input', updateRoomSize);
    document.getElementById('room-length').addEventListener('input', updateRoomSize);
    document.getElementById('room-height').addEventListener('input', updateRoomSize);
    document.getElementById('room-wall-color').addEventListener('input', buildRoom);
    document.getElementById('room-floor-color').addEventListener('input', buildRoom);

    // Camera Views
    document.getElementById('cam-top').addEventListener('click', () => {
        isWalkMode = false;
        controls.enabled = true;
        camera.position.set(0, roomWidth * 1.5, 0.01);
        controls.target.set(0, 0, 0);
    });

    document.getElementById('cam-front').addEventListener('click', () => {
        isWalkMode = false;
        controls.enabled = true;
        camera.position.set(0, roomHeight / 2, roomLength * 1.2);
        controls.target.set(0, roomHeight / 2, 0);
    });

    document.getElementById('cam-3d').addEventListener('click', () => {
        isWalkMode = false;
        controls.enabled = true;
        camera.position.set(6, 6, 8);
        controls.target.set(0, 0, 0);
    });

    document.getElementById('cam-walk').addEventListener('click', () => {
        isWalkMode = true;
        controls.enabled = false;
        camera.position.set(0, 1.6, roomLength / 2 - 0.5);
        camera.lookAt(0, 1.6, 0);
        alert('เข้าสู่โหมดเดินชมห้อง: ใช้ปุ่ม W, A, S, D เพื่อเคลื่อนที่');
    });

    // Object Property bindings
    document.getElementById('prop-pos-x').addEventListener('input', (e) => {
        if (selectedObject) selectedObject.position.x = parseFloat(e.target.value) || 0;
    });
    document.getElementById('prop-pos-z').addEventListener('input', (e) => {
        if (selectedObject) selectedObject.position.z = parseFloat(e.target.value) || 0;
    });
    document.getElementById('prop-rotation').addEventListener('input', (e) => {
        if (selectedObject) selectedObject.rotation.y = THREE.MathUtils.degToRad(parseFloat(e.target.value) || 0);
    });
    document.getElementById('prop-color').addEventListener('input', (e) => {
        if (selectedObject) {
            const newColor = e.target.value;
            selectedObject.userData.color = newColor;
            selectedObject.traverse(child => {
                if (child.isMesh) child.material.color.set(newColor);
            });
        }
    });

    // Duplicate & Delete
    document.getElementById('btn-delete').addEventListener('click', () => {
        if (selectedObject) {
            scene.remove(selectedObject);
            objectsInRoom = objectsInRoom.filter(o => o !== selectedObject);
            deselectObject();
        }
    });

    document.getElementById('btn-duplicate').addEventListener('click', () => {
        if (selectedObject) {
            const data = selectedObject.userData;
            const newObj = createFurniture(data.type, { color: data.color, w: data.width, h: data.height, d: data.depth });
            newObj.position.copy(selectedObject.position);
            newObj.position.x += 0.5;
            scene.add(newObj);
            objectsInRoom.push(newObj);
            selectObject(newObj);
        }
    });

    // Save & Load JSON
    document.getElementById('btn-save-json').addEventListener('click', () => {
        const roomData = {
            width: roomWidth,
            length: roomLength,
            height: roomHeight,
            wallColor: document.getElementById('room-wall-color').value,
            floorColor: document.getElementById('room-floor-color').value,
            objects: objectsInRoom.map(obj => ({
                type: obj.userData.type,
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z,
                rotation: obj.rotation.y,
                color: obj.userData.color,
                w: obj.userData.width,
                h: obj.userData.height,
                d: obj.userData.depth
            }))
        };

        const blob = new Blob([JSON.stringify(roomData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'room-design.json';
        a.click();
    });

    document.getElementById('input-load-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                document.getElementById('room-width').value = data.width;
                document.getElementById('room-length').value = data.length;
                document.getElementById('room-height').value = data.height;
                document.getElementById('room-wall-color').value = data.wallColor;
                document.getElementById('room-floor-color').value = data.floorColor;

                roomWidth = data.width; roomLength = data.length; roomHeight = data.height;
                buildRoom();

                // เคลียร์ของเก่า
                objectsInRoom.forEach(obj => scene.remove(obj));
                objectsInRoom = [];
                deselectObject();

                // โหลดวัตถุใหม่
                data.objects.forEach(item => {
                    const obj = createFurniture(item.type, { color: item.color, w: item.w, h: item.h, d: item.d });
                    obj.position.set(item.x, item.y, item.z);
                    obj.rotation.y = item.rotation;
                    scene.add(obj);
                    objectsInRoom.push(obj);
                });
            } catch (err) {
                alert('ไฟล์ JSON ไม่ถูกต้อง');
            }
        };
        reader.readAsText(file);
    });

    // Export PNG
    document.getElementById('btn-export-png').addEventListener('click', () => {
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'room-design.png';
        a.click();
    });

    // Walk Mode Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (!isWalkMode) return;
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (!isWalkMode) return;
        switch (e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
        }
    });
}

// Drag & Drop จากเมนูซ้ายมาวางบน Canvas
function setupDragAndDrop() {
    const items = document.querySelectorAll('.furniture-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.type);
        });
    });

    const container = document.getElementById('canvas-container');
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        if (!type) return;

        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(floorMesh);

        if (intersects.length > 0) {
            const intersectPoint = intersects[0].point;
            const newObj = createFurniture(type);
            newObj.position.set(intersectPoint.x, 0, intersectPoint.z);
            scene.add(newObj);
            objectsInRoom.push(newObj);
            selectObject(newObj);
        }
    });
}

// Raycasting เลือกวัตถุและลากเปลี่ยนตำแหน่ง
function onPointerDown(e) {
    if (isWalkMode) return;
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objectsInRoom, true);

    if (intersects.length > 0) {
        let rootObj = intersects[0].object;
        while (rootObj.parent && rootObj.parent !== scene) {
            rootObj = rootObj.parent;
        }
        selectObject(rootObj);
        isDragging = true;
        currentDragObject = rootObj;
        controls.enabled = false; // ปิดการหมุนกล้องขณะลากวัตถุ
    } else {
        deselectObject();
    }
}

function onPointerMove(e) {
    if (!isDragging || !currentDragObject || isWalkMode) return;
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(floorMesh);

    if (intersects.length > 0) {
        currentDragObject.position.x = intersects[0].point.x;
        currentDragObject.position.z = intersects[0].point.z;
        updatePropertiesPanel();
    }
}

function onPointerUp() {
    isDragging = false;
    currentDragObject = null;
    if (!isWalkMode) controls.enabled = true;
}

function selectObject(obj) {
    selectedObject = obj;
    updatePropertiesPanel();
    document.getElementById('no-selection').style.display = 'none';
    document.getElementById('selection-properties').style.display = 'block';
}

function deselectObject() {
    selectedObject = null;
    document.getElementById('no-selection').style.display = 'block';
    document.getElementById('selection-properties').style.display = 'none';
}

function updatePropertiesPanel() {
    if (!selectedObject) return;
    document.getElementById('prop-name').innerText = selectedObject.userData.name;
    document.getElementById('prop-pos-x').value = selectedObject.position.x.toFixed(2);
    document.getElementById('prop-pos-z').value = selectedObject.position.z.toFixed(2);
    document.getElementById('prop-rotation').value = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.y) % 360);
    document.getElementById('prop-color').value = selectedObject.userData.color;

function updatePropertiesPanel() {
    if (!selectedObject) return;
    document.getElementById('prop-name').innerText = selectedObject.userData.name;
    document.getElementById('prop-pos-x').value = selectedObject.position.x.toFixed(2);
    document.getElementById('prop-pos-z').value = selectedObject.position.z.toFixed(2);
    document.getElementById('prop-size-w').value = selectedObject.userData.width.toFixed(2);
    document.getElementById('prop-size-h').value = selectedObject.userData.height.toFixed(2);
    document.getElementById('prop-size-d').value = selectedObject.userData.depth.toFixed(2);
    document.getElementById('prop-rotation').value = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.y) % 360);
    document.getElementById('prop-color').value = selectedObject.userData.color;
}
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (isWalkMode) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 10.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 10.0 * delta;

        controls.moveForward(-velocity.z * delta);
        controls.moveRight(-velocity.x * delta);
    } else {
        controls.update();
    }

    prevTime = time;
    renderer.render(scene, camera);
}
const videoWidth = 300*3;
const videoHeight =  200*3;
const modelWidth = 256;
const modelHeight = 128;

const state = {
  maxFaces: 1,
  triangulateMesh: true
};

let model,model_canvas,video,ctx,canvas,camera;
let id;

/*
var yourself_value;
function previewFile(file) {
  // プレビュー画像を追加する要素
  const preview = document.getElementById('preview');

  // FileReaderオブジェクトを作成
  const reader = new FileReader();

  // URLとして読み込まれたときに実行する処理
  reader.onload = function (e) {
    const imageUrl = e.target.result; // URLはevent.target.resultで呼び出せる
    const img = document.createElement("img"); // img要素を作成
    img.src = imageUrl; // URLをimg要素にセット
    preview.appendChild(img); // #previewの中に追加
    console.log(img);
    console.log(imageUrl.toString());
    

    yourself_value = imageUrl.toString();
    
  }

  // いざファイルをURLとして読み込む
  reader.readAsDataURL(file);
}
// <input>でファイルが選択されたときの処理
const fileInput = document.getElementById('example');

const handleFileSelect = () => {
  const files = fileInput.files;
  for (let i = 0; i < files.length; i++) {
    previewFile(files[i]);
  }
}
fileInput.addEventListener('change', handleFileSelect);
*/


const change = async (button) => {
    id = "";
    if (button) {
      if (button.name == "photo") {
        if(button.value == "yourself")
        {
          console.log(button.value)
          id = yourself_value ;
        }
        if(button.value != "yourself")
        {
          id = "./photos/" + button.value;
        }

        console.log(id);
        $('#threejs_canvas').show('fast', function() 
        {
        });
        cameraon();
      }
      else if (button.name == "off") {
        console.log("off");
        $('#threejs_canvas').hide('fast', function() 
        {
        });
      }
    }
}

var prev_render;
const geometry = THREE.BufferGeometry();

function cameraon(){
// Threejs Init
const scene = new THREE.Scene();
const threejs_canvas = document.getElementById('threejs_canvas');
const threejs_render = new THREE.WebGLRenderer({ alpha: true } );
threejs_render.setPixelRatio(window.devicePixelRatio);
threejs_render.setSize(videoWidth, videoHeight);
threejs_render.setClearColor( 0x000000, 0 );


console.log(threejs_canvas.hasChildNodes());
// ボディにレンダラ（canvas）を追加
if (threejs_canvas.hasChildNodes()) {
  threejs_canvas.removeChild(prev_render);
}
threejs_canvas.appendChild(threejs_render.domElement);
prev_render = threejs_render.domElement;


const material = new THREE.MeshBasicMaterial();
const mesh = new THREE.Mesh(geometry,material);
mesh.rotation.set(Math.PI,Math.PI,0);
scene.add(mesh);

tf.setBackend('wasm').then(() => main());

async function setupModelCanvas() {

  model_canvas = document.getElementById('model_canvas');
  model_canvas.width = modelWidth;
  model_canvas.height = modelHeight;

  let model_ctx = model_canvas.getContext('2d');

  //let src = 'lena30.jpg';
  //let src = 'hair_biyou_kirei_ojiisan.png';

  let src = id;//この画像変えれば変わる
  console.log(src)
  const img = await loadImage(src).catch(e => {
    console.log('onload error', e);
  });
  model_ctx.drawImage(img,0,0,modelWidth,modelHeight);
  
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
    console.log(img.src)
  });
}

async function main() {

  await setupModelCanvas();
  await setupCamera();
  video.play();

  // threejs camera create
  const fov    = 1;
  const fovRad = (fov / 2) * (Math.PI / 180);
  const dist   = (video.videoHeight / 2) / Math.tan(fovRad);

  camera = new THREE.PerspectiveCamera(fov, video.videoWidth/ video.videoHeight, 1, dist * 2);
  camera.position.z = dist;
  camera.position.x = video.videoWidth/2 * -1;
  camera.position.y = video.videoHeight/2 * -1;

  canvas = document.getElementById('output');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const canvasContainer = document.querySelector('.video_block');
  canvasContainer.style = `width: ${videoWidth}px; height: ${videoHeight}px`;

  ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = '#32EEDB';
  ctx.strokeStyle = '#32EEDB';
  ctx.lineWidth = 0.5;

  model = await facemesh.load({maxFaces: state.maxFaces});

  await threejsRenderPrediction();
  renderPrediction();
  
}

async function threejsRenderPrediction() {
  const predictions = await model.estimateFaces(model_canvas);
  if (predictions.length > 0) {
    predictions.forEach(prediction => {
      const keypoints = prediction.scaledMesh;
      threejsCreateMesh(keypoints);
    });
  }
}

function threejsCreateMesh(keypoints) {
  
  let texture = new THREE.CanvasTexture(model_canvas);
  texture.flipY = false;
  
  let pos = new Float32Array(
    Array.prototype.concat.apply([],TRIANGULATION.map(index => keypoints[index])));

  let uv = new Float32Array(
    Array.prototype.concat.apply([],
      TRIANGULATION.map(index => 
        [keypoints[index][0] / modelWidth, keypoints[index][1] / modelHeight])));

  mesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  mesh.material = new THREE.MeshBasicMaterial({ map: texture , 
                                                side: THREE.DoubleSide });
  threejs_render.render(scene, camera);
}

function threejsUpdateMesh(keypoints) {
  mesh.geometry.attributes.position.needsUpdate = true;  
  mesh.geometry.attributes.position.array = new Float32Array(
    Array.prototype.concat.apply([],TRIANGULATION.map(index => keypoints[index])));
  
  threejs_render.render(scene, camera);
}

async function setupCamera() {
  video = document.getElementById('video');

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      // Only setting the video to a specified size in order to accommodate a
      // point cloud, so on mobile devices accept the default size.
      width: videoWidth,
      height: videoHeight
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function renderPrediction() {

  const predictions = await model.estimateFaces(video);
  ctx.drawImage(
      video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, canvas.width, canvas.height);
      
  if (predictions.length > 0) {
    predictions.forEach(prediction => {
      const keypoints = prediction.scaledMesh;
      threejsUpdateMesh(keypoints);
    });
  }
  requestAnimationFrame(renderPrediction);
}

function drawPath(ctx, points, closePath) {
  const region = new Path2D();
  region.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    region.lineTo(point[0], point[1]);
  }

  if (closePath) {
    region.closePath();
  }
  ctx.stroke(region);
}


}
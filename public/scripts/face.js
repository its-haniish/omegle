const maleGenderImg=document.getElementById("male_gender_img");
const maleGenderBtn=document.getElementById("male_gender_btn");
const femaleGenderImg=document.getElementById("female_gender_img");
const femaleGenderBtn=document.getElementById("female_gender_btn");

document.getElementById("reset_btn").addEventListener("click", () => {
  localStorage.removeItem("omegle-data");
  window.location.reload();
});


let selectedGender="male";
let cameraStream=null; // Store the camera stream

maleGenderBtn.addEventListener("click", () => {
  selectedGender="male";
  maleGenderImg.src="/happy_m.png";
  femaleGenderImg.src="/sad_f.png";
  femaleGenderBtn.classList.remove("active_gender");
  maleGenderBtn.classList.add("active_gender");
});

femaleGenderBtn.addEventListener("click", () => {
  selectedGender="female"; // FIXED: It was incorrectly set to "male"
  femaleGenderImg.src="/happy_f.png";
  maleGenderImg.src="/sad_m.png";
  maleGenderBtn.classList.remove("active_gender");
  femaleGenderBtn.classList.add("active_gender");
});

// Camera feed logic
// const enableCameraBtn=document.getElementById('enable_camera_btn');
const videoElement=document.getElementById('video');
const cameraNotification=document.getElementById('camera_notification');

// async function startCamera() {
//   if (!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) {
//     alert('Camera not supported by this browser.');
//     return;
//   }

//   try {
//     localStream=await navigator.mediaDevices.getUserMedia({ video: true });
//     videoElement.srcObject=localStream;
//     cameraNotification.style.display='none';
//     videoElement.style.width='100%';
//   } catch (err) {
//     console.error("Error accessing the camera: ", err);
//     alert("Unable to access camera. Check permissions.");
//   }
// }

// enableCameraBtn.addEventListener('click', async () => {
//   await startCamera();
// });

const startChatBtn=document.getElementById('start_chat_btn');

startChatBtn.addEventListener('click', async () => {

  document.getElementById("select_gender_screen").style.display="none";
  document.getElementById("identify_gender_screen").style.display="flex";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.ageGenderNet.loadFromUri('/models')
  ]);

  // await startCamera(); // Ensure camera is started
  detectGender();
});

let genderDetected=false;
async function detectGender() {


  if (genderDetected) return;
  const interval=setInterval(async () => {
    if (!videoElement.srcObject||genderDetected) return; // Stop if gender is already detected

    const detections=await faceapi.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions()).withAgeAndGender();

    if (detections) {
      socket.emit("gender_detected", { gender: detections.gender, selectedGender, probability: detections.genderProbability });
      localStorage.setItem("omegle-data", JSON.stringify({ selectedGender, gender: detections.gender, probability: detections.genderProbability, selectedGender: selectedGender }));
      document.getElementById("identify_gender_screen").style.display
        ="none";
      document.getElementById("loading_next_screen").style.display="flex";
      genderDetected=true; // Stop further emissions
      clearInterval(interval); // Stop the setInterval
      // **Create WebRTC Offer**
      await createAndSendOffer();
    } else {
      console.log("No face detected. Adjust position.");
    }
  }, 2000);
}


const checkLocalData=() => {
  const data=localStorage.getItem("omegle-data");
  if (!data) {
    console.log("No data found in local storage.");
    return false;
  }

  const parsedData=JSON.parse(data);
  if (parsedData.selectedGender===undefined||selectedGender===null) {
    console.log("No selected");
    localStorage.removeItem("omegle-data");
    window.location.reload();
    return false;
  }
  console.log("📝 Found data in local storage:", parsedData);
  loadingScreen.style.display="flex"

  // If gender detection previously failed, show Start Chat button
  if (!parsedData.gender) {
    document.getElementById("select_gender_screen").style.display="flex";
    document.getElementById("identify_gender_screen").style.display="none";
    return false;
  }

  return parsedData;
};

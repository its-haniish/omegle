const maleGenderImg = document.getElementById("male_gender_img");
const maleGenderBtn = document.getElementById("male_gender_btn");
const femaleGenderImg = document.getElementById("female_gender_img");
const femaleGenderBtn = document.getElementById("female_gender_btn");

let selectedGender = "male";

maleGenderBtn.addEventListener("click", () => {
  selectedGender = "male";
  maleGenderImg.src = "/happy_m.png";
  femaleGenderImg.src = "/sad_f.png";
  femaleGenderBtn.classList.remove("active_gender");
  maleGenderBtn.classList.add("active_gender");
});

femaleGenderBtn.addEventListener("click", () => {
  selectedGender = "male";
  femaleGenderImg.src = "/happy_f.png";
  maleGenderImg.src = "/sad_m.png";
  maleGenderBtn.classList.remove("active_gender");
  femaleGenderBtn.classList.add("active_gender");
});

// camera feed logic
const enableCameraBtn = document.getElementById('enable_camera_btn');
const videoElement = document.getElementById('video');
const cameraNotification = document.getElementById('camera_notification');

enableCameraBtn.addEventListener('click', async () => {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoElement.srcObject = stream;
        cameraNotification.style.display = 'none';  // Hide the notification once the camera is enabled
        videoElement.style.width = '100%';
      })
      .catch(err => {
        console.error("Error accessing the camera: ", err);
        alert("Unable to access camera. Please check permissions.");
      });
  } else {
    alert('Camera not supported by this browser.');
  }
});

const socket = io();
const username = new URLSearchParams(location.search).get("username");
const users = [username];
const userList = document.querySelector(".user-list");
const modeSelector = document.querySelector(".mode-selector");

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let latestCanvasImage = new Image();

const modes = ["draw", "erase", "line", "rectangle"];
let currentMode = 0;

const drawSize = 15;
const eraseSize = 30;

let clickPos, dragPos;
let pressing = false;
let tick = 0;

socket.once("oldUsers", (oldUsers) => {
  if (oldUsers.length) {
    users.push(...oldUsers);
  }

  updateUserList();
});
socket.once("oldCanvas", (canvasImage) => canvasImage && (latestCanvasImage.src = canvasImage));

socket.on("updateCanvas", (canvasImage) => (latestCanvasImage.src = canvasImage));
socket.on("join", (username) => users.push(username) && updateUserList());
socket.on("leave", (username) => users.splice(users.indexOf(username), 1) && updateUserList());

socket.emit("setName", username);

latestCanvasImage.addEventListener("load", () =>
  (currentMode === 0 || currentMode === 1) && pressing
    ? sendImage() && drawLatestImage()
    : drawLatestImage()
);

window.addEventListener("DOMContentLoaded", () => {
  for (let mode of modes) {
    const modeElement = document.createElement("img");
    modeElement.addEventListener("click", () => {
      if (currentMode === modes.indexOf(mode)) {
        return;
      }

      currentMode = modes.indexOf(mode);

      const selected = document.querySelector(".mode-selector .selected");
      selected.classList.remove("selected");
      modeElement.classList.add("selected");
    });
    modeElement.src = `/images/${mode}.png`;
    modeElement.width = modeElement.height = 40;

    if (mode === "draw") {
      modeElement.classList.add("selected");
    }

    modeSelector.appendChild(modeElement);
  }

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ctx.strokeStyle = "black";
});

canvas.addEventListener("mousedown", (e) => {
  clickPos = { x: e.offsetX, y: e.offsetY };
  pressing = true;
  ctx.fillStyle = "black";

  if (currentMode === 0 || currentMode === 1) {
    if (currentMode === 0) {
      ctx.fillRect(e.offsetX - drawSize / 2, e.offsetY - drawSize / 2, drawSize, drawSize);
    } else if (currentMode === 1) {
      ctx.fillStyle = "white";
      ctx.fillRect(e.offsetX - eraseSize / 2, e.offsetY - eraseSize / 2, eraseSize, eraseSize);
    }
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (!pressing) {
    return;
  }

  dragPos = { x: e.offsetX, y: e.offsetY };
  ctx.fillStyle = "black";

  if (currentMode === 0 || currentMode === 1) {
    if (currentMode === 0) {
      ctx.fillRect(e.offsetX - drawSize / 2, e.offsetY - drawSize / 2, drawSize, drawSize);
    } else if (currentMode === 1) {
      ctx.fillStyle = "white";
      ctx.fillRect(e.offsetX - eraseSize / 2, e.offsetY - eraseSize / 2, eraseSize, eraseSize);
    }

    tick++;

    if (tick >= 50) {
      sendImage();

      tick = 0;
    }
  } else if (currentMode === 2) {
    drawLatestImage();

    ctx.beginPath();
    ctx.moveTo(clickPos.x, clickPos.y);
    ctx.lineTo(dragPos.x, dragPos.y);
    ctx.stroke();
  } else if (currentMode === 3) {
    drawLatestImage();

    const x = clickPos.x < dragPos.x ? clickPos.x : dragPos.x;
    const y = clickPos.y < dragPos.y ? clickPos.y : dragPos.y;
    const width = Math.abs(clickPos.x - dragPos.x);
    const height = Math.abs(clickPos.y - dragPos.y);
    ctx.fillRect(x, y, width, height);
  }
});
canvas.addEventListener("mouseup", (e) => {
  pressing = false;
  clickPos = dragPos = undefined;
  tick = 0;

  latestCanvasImage.src = canvas.toDataURL();
  socket.emit("updateCanvas", latestCanvasImage.src);
});

function updateUserList() {
  userList.innerHTML = "";

  for (let user of users) {
    const userElement = document.createElement("div");
    userElement.innerText = user;

    userList.appendChild(userElement);
  }
}

function drawLatestImage() {
  if (latestCanvasImage.src) {
    ctx.drawImage(latestCanvasImage, 0, 0);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function sendImage() {
  latestCanvasImage.src = canvas.toDataURL();
  socket.emit("updateCanvas", latestCanvasImage.src);
}

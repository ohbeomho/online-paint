const socket = io();
const username = new URLSearchParams(location.search).get("username");
const users = [username];
const userList = document.querySelector(".user-list");
const modeSelector = document.querySelector(".mode-selector");
const chatInput = document.querySelector(".chat-input");
const chatList = document.querySelector(".chat-list");

const canvas = document.querySelectorAll("canvas")[0];
const previewCanvas = document.querySelectorAll("canvas")[1];
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const pctx = previewCanvas.getContext("2d");
let latestCanvasImage = new Image();

const nameElements = [];

const modes = ["draw", "erase", "line", "rectangle"];
let currentMode = 0;

const drawSize = 10;
const eraseSize = 20;

let clickPos, dragPos;
let pressing = false;
let posArray = [];

socket.once("oldUsers", (oldUsers) => {
  if (oldUsers.length) {
    users.push(...oldUsers);
  }

  updateUserList();
});
socket.once("oldCanvas", (canvasImage) => canvasImage && (latestCanvasImage.src = canvasImage));

socket.on("draw", (data, username) => {
  let exists = nameElements.find((ne) => ne.name === username);
  const element = !exists && document.createElement("div");
  let nameElement = exists
    ? exists
    : {
        name: username,
        element,
        timeout: setTimeout(
          () => nameElements.splice(nameElements.length, 1) && element.remove(),
          1500
        )
      };

  if (exists) {
    clearTimeout(nameElement.timeout);
    nameElement.timeout = setTimeout(
      () =>
        nameElements.splice(nameElements.indexOf(nameElement), 1) && nameElement.element.remove(),
      1500
    );
  } else {
    nameElement.element.classList.add("draw-username");
    nameElement.element.innerText = username;
    nameElement.element.style.position = "absolute";

    document.body.appendChild(nameElement.element);

    nameElements.push(nameElement);
  }

  if (data.mode === 0 || data.mode === 1) {
    const size = data.mode === 0 ? drawSize : eraseSize;
    ctx.fillStyle = data.mode === 0 ? "black" : "white";

    let previousPos;

    for (let pos of data.posArray) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, 2 * Math.PI);
      ctx.fill();

      if (previousPos) {
        ctx.lineWidth = size * 2;
        ctx.strokeStyle = ctx.fillStyle;

        ctx.beginPath();
        ctx.moveTo(previousPos.x, previousPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      previousPos = pos;
    }

    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 10;

    nameElement.element.style.left = `${
      canvas.offsetLeft + data.posArray[data.posArray.length - 1].x
    }px`;
    nameElement.element.style.top = `${
      canvas.offsetTop + data.posArray[data.posArray.length - 1].y
    }px`;

    latestCanvasImage.src = canvas.toDataURL();
  } else if (data.mode === 2) {
    ctx.beginPath();
    ctx.moveTo(data.startPos.x, data.startPos.y);
    ctx.lineTo(data.endPos.x, data.endPos.y);
    ctx.stroke();

    nameElement.element.style.left = `${canvas.offsetLeft + data.endPos.x}px`;
    nameElement.element.style.top = `${canvas.offsetTop + data.endPos.y}px`;
  } else if (data.mode === 3) {
    ctx.fillStyle = "black";

    ctx.fillRect(data.x, data.y, data.width, data.height);

    nameElement.element.style.left = `${canvas.offsetLeft + data.x}px`;
    nameElement.element.style.top = `${canvas.offsetTop + data.y}px`;
  }

  sendImage();
});
socket.on("join", (username) => {
  users.push(username);
  addMessage(`'${username}' joined.`, "notice");
  updateUserList();
});
socket.on("leave", (username) => {
  users.splice(users.indexOf(username), 1);
  addMessage(`'${username}' leaved.`, "notice");
  updateUserList();
});
socket.on("chat", (message, username) => addMessage({ username, text: message }, "chat"));

socket.emit("setName", username);

latestCanvasImage.addEventListener("load", () => drawImage());

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
  ctx.fillStyle = ctx.strokeStyle = pctx.fillStyle = pctx.strokeStyle = "black";
  pctx.lineWidth = ctx.lineWidth = 10;

  // +1 because main canvas has 1px border.
  previewCanvas.style.left = `${canvas.offsetLeft + 1}px`;
  previewCanvas.style.top = `${canvas.offsetTop + 1}px`;
});
window.addEventListener("resize", () => {
  previewCanvas.style.left = `${canvas.offsetLeft + 1}px`;
  previewCanvas.style.top = `${canvas.offsetTop + 1}px`;
});

chatInput.addEventListener("keydown", (e) => {
  if (!e.repeat && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (!chatInput.value.trim()) {
      return;
    }

    addMessage({ username, text: chatInput.value }, "chat");
    socket.emit("chat", chatInput.value);

    chatInput.value = "";
  }
});

previewCanvas.addEventListener("mousedown", (e) => {
  clickPos = { x: e.offsetX, y: e.offsetY };
  pressing = true;
  ctx.fillStyle = "black";

  if (currentMode === 0 || currentMode === 1) {
    const size = currentMode === 0 ? drawSize : eraseSize;
    ctx.fillStyle = currentMode === 0 ? "black" : "white";

    ctx.beginPath();
    ctx.arc(clickPos.x, clickPos.y, size, 0, 2 * Math.PI);
    ctx.fill();

    posArray.push(clickPos);
    sendDraw({ posArray });
    posArray = [];
  }
});
previewCanvas.addEventListener("mousemove", (e) => {
  if (!pressing) {
    return;
  }

  let previousPos = dragPos;
  dragPos = { x: e.offsetX, y: e.offsetY };
  ctx.fillStyle = "black";

  if (currentMode === 0 || currentMode === 1) {
    const size = currentMode === 0 ? drawSize : eraseSize;
    ctx.fillStyle = currentMode === 0 ? "black" : "white";

    ctx.beginPath();
    ctx.arc(dragPos.x, dragPos.y, size, 0, 2 * Math.PI);
    ctx.fill();

    if (previousPos) {
      ctx.lineWidth = size * 2;
      ctx.strokeStyle = ctx.fillStyle;

      ctx.beginPath();
      ctx.moveTo(previousPos.x, previousPos.y);
      ctx.lineTo(dragPos.x, dragPos.y);
      ctx.stroke();
    }

    ctx.strokeStyle = "black";
    ctx.lineWidth = 10;

    posArray.push(dragPos);

    if (posArray.length >= 50) {
      sendDraw({ posArray });
      posArray = [];
    }
  } else if (currentMode === 2) {
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pctx.beginPath();
    pctx.moveTo(clickPos.x, clickPos.y);
    pctx.lineTo(dragPos.x, dragPos.y);
    pctx.stroke();
  } else if (currentMode === 3) {
    pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const x = clickPos.x < dragPos.x ? clickPos.x : dragPos.x;
    const y = clickPos.y < dragPos.y ? clickPos.y : dragPos.y;
    const width = Math.abs(clickPos.x - dragPos.x);
    const height = Math.abs(clickPos.y - dragPos.y);
    pctx.fillRect(x, y, width, height);
  }
});
previewCanvas.addEventListener("mouseup", (e) => {
  pressing = false;

  if ((currentMode === 0 || currentMode === 1) && posArray.length) {
    sendDraw({ posArray });
    posArray = [];
  } else if (currentMode === 2) {
    ctx.beginPath();
    ctx.moveTo(clickPos.x, clickPos.y);
    ctx.lineTo(dragPos.x, dragPos.y);
    ctx.stroke();

    sendDraw({
      startPos: { x: clickPos.x, y: clickPos.y },
      endPos: { x: dragPos.x, y: dragPos.y }
    });
  } else if (currentMode === 3) {
    const x = clickPos.x < dragPos.x ? clickPos.x : dragPos.x;
    const y = clickPos.y < dragPos.y ? clickPos.y : dragPos.y;
    const width = Math.abs(clickPos.x - dragPos.x);
    const height = Math.abs(clickPos.y - dragPos.y);
    ctx.fillRect(x, y, width, height);
    sendDraw({ x, y, width, height });
  }

  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  clickPos = dragPos = undefined;

  sendImage();
});

function updateUserList() {
  userList.innerHTML = "";

  for (let user of users) {
    const userElement = document.createElement("div");
    userElement.innerText = user;

    userList.appendChild(userElement);
  }
}

function drawImage() {
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

function sendDraw(data) {
  socket.emit("draw", { mode: currentMode, ...data });
}

function addMessage(message, type) {
  const chatElement = document.createElement("li");
  if (type === "notice" || (type === "chat" && message.username === username)) {
    chatElement.classList.add(type === "notice" ? "notice" : "me");
  }

  chatElement.innerHTML =
    type === "chat"
      ? `<div class="username">${message.username}</div>
         <div class="content">${message.text}</div>`
      : `<div>${message}</div>`;

  chatList.appendChild(chatElement);
  chatList.scrollTo(0, chatList.scrollHeight);
}

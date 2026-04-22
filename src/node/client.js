var socket = io();

class Chatroom {
    ChatID;
    ChatName;
    UserList;
    ActiveUserList;
    MessageList;

    constructor(id, name) {
        this.ChatID = id;
        this.ChatName = name;
        this.UserList = [];
        this.ActiveUserList = [];
        this.MessageList = [];
    }
}

class ChatMessage {
    UserID;
    UserName; // temp
    Message;

    constructor(id, name, message) {
        this.UserID = id;
        this.UserName = name;
        this.Message = message;
    }
}


const input = document.getElementById("inputField");
const tableContainer = document.getElementById("chatTableContainer");
let table = null;

const chatDiv = document.getElementById("chatDiv");
const settingsDiv = document.getElementById("settingsDiv");
const chatroomsDiv = document.getElementById("chatroomsDiv");

let currentTab = "";
let currentRoomID = -1;

socket.on("SessionStorage", (counter) => {
    InitSessionStorage(counter);
});

socket.on("newmessage", (message) => {
    //console.log("new message received");
    AddNewMessageToTable(message);
});

socket.on("receiveRooms", (rooms) => {
    PresentRooms(rooms);
});

socket.on("receiveRoomList", (roomList) => {
    ListRooms(roomList);
});

socket.on("receiveChatroom", (room) => {
    ReceiveChatroom(room);
});

socket.on("newMessageRoom", (message) => {
    AddNewMessageInRoom(message);
});


// pt er data bare userCounter, så altid Number
function InitSessionStorage(data) {
    // Hacky
    Entry();
    sessionStorage.setItem("username", "Bruger " + String(data));
}

function Entry() {

}

// Senere, når brugere er knyttet på DB, skal navn og ID findes andre steder
function SendMessageRoom() {
    if (input.value) {
        socket.emit("chatMessageRoom", socket.id, currentRoomID, input.value);
        input.value = "";
    }
}

function OnSideBarButtonPressed(button) {
    // Åbner ikke den samme menu igen
    if (String(button) === String(currentTab)) {
        return;
    }

    switch (button) {
        case "chat":
            chatroomsDiv.classList.add("Hidden");
            settingsDiv.classList.add("Hidden");
            chatDiv.classList.remove("Hidden");
            socket.emit("getRoomList");
            break;

        case "rooms":
            chatDiv.classList.add("Hidden");
            settingsDiv.classList.add("Hidden");
            chatroomsDiv.classList.remove("Hidden");
            socket.emit("getRooms");
            break;

        case "settings":
            chatDiv.classList.add("Hidden");
            chatroomsDiv.classList.add("Hidden");
            settingsDiv.classList.remove("Hidden");
            break;
    
        default:
            console.log("a");
            break;
    }

    // Hvis den gamle menu var rooms, så fjern elementerne
    if (String(currentTab) === "rooms") {
        ClearRooms();
    }
    else if (String(currentTab) === "chat") {
        ClearElementOfChildren("chatList");
    }

    currentTab = String(button);
}

function PresentRooms(rooms) {
    for (let i = 0; i < rooms.length; i++) {
        let box = document.createElement("div");
        box.classList.add("ChatroomShowcaseBox");
        
        let name = document.createElement("span");
        name.innerText = String(rooms[i].ChatName);
        box.appendChild(name);

        let button = document.createElement("button");
        button.innerText = "Deltag";
        button.onclick = function() { TryJoinRoom(rooms[i].ChatID) };
        box.appendChild(button);

        roomsGrid.appendChild(box);
    }
}

function ClearRooms() {
    const roomsGrid = document.getElementById("roomsGrid");

    while (roomsGrid.firstChild) {
        roomsGrid.removeChild(roomsGrid.lastChild);
    }
}

function TryJoinRoom(roomID) {
    socket.emit("tryJoinRoom", roomID);
}

function TryEnterRoom(roomID) {
    socket.emit("tryEnterRoom", roomID);
}

function ListRooms(roomList) {
    console.log("Listing " + roomList.length + " rooms");
    const chatList = document.getElementById("chatList");

    for (let i = 0; i < roomList.length; i++) {
        const room = roomList[i];
        
        let roomListing = document.createElement("div");

        let button = document.createElement("button");
        button.innerText = room.ChatName;
        button.onclick = function () { socket.emit("tryEnterRoom", room.ChatID) };
        roomListing.appendChild(button);

        chatList.appendChild(roomListing);
    }
}

// table skal gerne ikke findes i DOM'en mens dette sker, for at mindske mængden af opdateringer
function ReceiveChatroom(room) {
    currentRoomID = room.ChatID;

    const messages = room.MessageList;

    if (tableContainer.children.length !== 0) {
        tableContainer.removeChild(tableContainer.firstChild);
    }

    table = document.createElement("table");
    table.classList.add("ChatLog");

    for (let i = 0; i < messages.length; i++) {
        let tr = document.createElement("tr");

        let name = document.createElement("td");
        name.innerText = messages[i].UserName;
        tr.appendChild(name);

        let msg = document.createElement("td");
        msg.innerText = messages[i].Message;
        tr.appendChild(msg);

        table.appendChild(tr);
    }

    tableContainer.appendChild(table);
}

function AddNewMessageInRoom(message) {
    let tr = document.createElement("tr");

    let name = document.createElement("td");
    name.innerText = message.UserName;
    tr.appendChild(name);

    let msg = document.createElement("td");
    msg.innerText = message.Message;
    tr.appendChild(msg);

    table.appendChild(tr);
}

function TrySetScreenName() {
    const input = document.getElementById("displayNameInput");

    const newName = input.value;

    socket.emit("changeDisplayName", newName);
}

function ClearElementOfChildren(elementID) {
    const element = document.getElementById(String(elementID));

    while (element.firstChild) {
        element.removeChild(element.lastChild);
    }
}

// node --env-file=.env server.js

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { serialize, parse } from "cookie";
import cookieParser from "cookie-parser";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { stat } from "node:fs";

class User {
    ID;
    DisplayName;
    RoomsList;

    ActiveRoomID; // Midlertidig. Kan sikkert gemmes i SessionStorage?

    constructor(id, name) {
        this.ID = id;
        this.DisplayName = name;
        this.RoomsList = [];

        this.ActiveRoomID = -1;
    }
}

class Chatroom {
    ChatID;
    ChatName;
    UserList;
    ActiveUserList;
    MessageList;
    PasswordProtected;
    //Hidden    ; Faktor på DB, ikke så meget her

    constructor(id, name) {
        this.ChatID = id;
        this.ChatName = name;
        this.UserList = [];
        this.ActiveUserList = [];
        this.MessageList = [];
        this.PasswordProtected = false;
    }
}

class ChatMessage {
    UserID;
    UserName; // temp
    Message;
    // Timestamp

    constructor(id, name, message) {
        this.UserID = id;
        this.UserName = name;
        this.Message = message;
    }
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hostname = "127.0.0.1";
const port = 3000;


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {origin: "*" },
});

app.use(express.json());
app.use(cookieParser());


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/app.html");
});

app.get("/app_client.js", (req, res) => {
    res.sendFile(__dirname + "/app_client.js");
});

app.get("/style.css", (req, res) => {
    res.sendFile(__dirname + "/style.css");
});


app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/login.html");
});

app.get("/login_client.js", (req, res) => {
    res.sendFile(__dirname + "/login_client.js");
});


app.post("/login/creds", async (req, res) => {
    const response = await OnClientTryLoginRequest(req);

    if (response.ok) {
        const json = await response.json();
        
        res.cookie("access_token", json.access_token, { httpOnly: true });
        res.cookie("refresh_token", json.refresh_token, { httpOnly: true });
        res.cookie("token_type", json.token_type, { httpOnly: true });

        res.status(response.status).send("Yay");
    }
    else {
        res.status(response.status).send("Nay");
    }
})

app.post("/login/refresh", async (req, res) => {
    const response = await OnClientTryLoginRefresh(req);
    const json = await response.json();
    console.log(json);

    if (response.ok) {
        res.cookie("access_token", json.access_token, { httpOnly: true });
        res.cookie("refresh_token", json.refresh_token, { httpOnly: true });
        res.cookie("token_type", json.token_type, { httpOnly: true });

        res.status(response.status).send("Yay");
    }
    else {
        res.status(response.status).send("Nay");
    }
});


function Entry() {
    //console.log(process.env.DATABASE_URL);
}


// ========== Client management ==========

io.on("connection", (socket) => {
    // Account
    socket.on("tryLogin", async (username, password, callback) => {
        callback(await OnSocketTryLogin(socket, username, password));
    });
    
    socket.on("tryRegister", async (username, displayname, password, callback) => {
        callback(await OnSocketTryRegister(socket, username, displayname, password));
    });

    socket.on("clientLogOut", async (callback) => {
        callback(await OnSocketClientLogOut(socket));
    });

    socket.on("changeDisplayName", (newName) => {
        ChangeUserDisplayName(socket, newName);
    });

    // App
    socket.on("getDiscovery", () => {
        OnSocketTryGetDiscovery(socket);
    });

    socket.on("getRoomList", () => {
        SendRoomListToSocket(socket);
    });

    socket.on("getUserInfo", async (userID, callback) => {
        callback(await OnSocketGetUserInfo(userID));
    });

    socket.on("getOwnInfo", async (callback) => {
        callback(await OnSocketGetOwnInfo(socket));
    });

    socket.on("tryJoinRoom", (userID, roomID, password) => {
        OnSocketTryJoinChatroom(socket, userID, roomID, password);
    });

    socket.on("tryEnterRoom", (roomID) => {
        OnSocketTryEnterChatroom(socket, roomID);
    });

    socket.on("tryCreateChatroom", (userID, chatroomName, chatroomPW, isPrivate) => {
        OnSocketTryCreateChatroom(socket, userID, chatroomName, chatroomPW, isPrivate);
    });

    socket.on("chatMessageRoom", (userID, roomID, message) => {
        OnNewMessageInChatroom(socket, userID, roomID, message);
    });

    socket.on("deleteMessage", (roomID, messageID) => {
        OnSocketDeleteMessage(socket, roomID, messageID);
    });

    socket.on("kickUser", (roomID, userID) => {
        OnSocketKickUser(socket, roomID, userID);
    });

    socket.on("disconnect", () => {
        //console.log("user disconnected");
    });
});


// ========== Account ==========

async function OnSocketTryLogin(socket, username, password) {
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            code: password
        })
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/login", requestOptions);
        const json = await response.json();

        if (response.ok) {
            callback.status = "OK";
            callback.payload = json;
        }
        else {
            callback.status = "NOK";
        }
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
    }

    return callback;
}

async function OnClientTryLoginRequest(req) {
    const reqJSON = req.body;

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            username: reqJSON.username,
            code: reqJSON.code
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/login", requestOptions);
        return response;

    }
    catch (error) {
        console.error(error.message);
    }
}

// Ikke færdig
async function OnClientTryLoginRefresh(req) {
    const cookies = req.cookies;
    //console.log(reqJSON);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            refresh_token: cookies.refresh_token
        })
    };

    //console.log(cookies.refresh_token);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/refresh", requestOptions);
        return response;
    }
    catch (error) {
        console.error(error.message);
    }
}

// Ikke færdig
async function OnSocketClientLogOut(socket) {
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            refresh_token: ""
        })
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/logout", requestOptions);
        const json = await response.json();

        if (response.ok) {
            callback.status = "OK";
        }
        else {
            callback.status = "NOK";
        }
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
        callback.payload.message = "Unknown error";
    }

    return callback;
}

async function OnSocketTryRegister(socket, username, displayname, password) {
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            display_name: displayname,
            code: password
        })
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/signup", requestOptions);
        const json = await response.json();

        if (response.ok) {
            callback.status = "OK";
        }
        else {
            callback.status = "NOK";
        }

        callback.payload = json;

        return callback;
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
        callback.payload.message = "Unknown error";

        return callback;
    }
}

async function OnSocketGetOwnInfo(socket) {
    // Fixme: Tjek om brugeren overhovedet er logget ind, før de prøver at koble på
    if (!socket.handshake.headers.cookie) {
        socket.emit("goToLogin");
        return;
    }

    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/me", requestOptions);
        const json = await response.json();

        //console.log(response);
        //console.log(json);

        if (response.ok) {
            callback.status = "OK";
            callback.payload = json;
        }
        else if (response.status === 401) {
            socket.emit("goToLogin");
        }
        else {
            callback.status = "NOK";
        }
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
    }

    return callback;
}

// Ændrer ikke retroaktivt på beskeder. Husk at forbinde bruger id med skærmnavn, og ikke gem navnet i beskeden
// Kan eventuelt cache/gemme en lille lookup tabel, når brugeren deltager i et chatrum, og så spare på noget data der
// Rummet gemmer dog allerede på brugere, men de har ikke navne med
function ChangeUserDisplayName(socket, newName) {
    /*
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        users[uindex].DisplayName = newName;
    }
    */
}


// ========== Chatroom ==========

async function SendRoomListToSocket(socket) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/my", requestOptions);
        const json = await response.json();

        //console.log(response);

        //console.log("Room List");
        //console.log(json);

        socket.emit("receiveRoomList", json);
    }
    catch (error) {
        console.error(error);
    }
}

async function OnSocketTryEnterChatroom(socket, roomID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID, requestOptions);

        if (response.ok) {
            const json = await response.json();
            //console.log(json);

            if (socket.activeRoomID !== -1) {
                socket.leave(String(socket.activeRoomID));
            }

            socket.activeRoomID = roomID;
            socket.join(String(roomID));

            ServeChatroomToSocket(socket, json);
            //ServeChatroomMessagesToSocket(socket, json);
        }
    }
    catch (error) {
        console.error(error);
    }
}

function ServeChatroomToSocket(socket, room) {
    socket.emit("receiveChatroom", room);
}

function ServeChatroomMessagesToSocket(socket, messages) {
    console.log("Messages served");
    socket.emit("receiveMessages", messages);
}

async function OnSocketGetUserInfo(userID) {
    const requestOptions = {
        method: "GET",
        headers: {
            "Content-type": "application/json",
        }
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/users/" + userID, requestOptions);
        //console.log("Bruger info GET:");
        //console.log(response);

        if (response.ok) {
            const json = await response.json();
            //console.log(json);
            callback.status = "OK";
            callback.payload = json;
        }
        else {
            callback.status = "NOK";
            callback.payload.display_name = "Uidentificeret bruger";
        }
    }
    catch (error) {
        console.error(error);
        callback.status = "NOK";
        callback.message = "Ukendt fejl";
    }

    return callback;
}

async function OnSocketKickUser(socket, roomID, userID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            room_id: roomID,
            user_id: userID
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID + "/users/" + userID, requestOptions);

        if (response.ok) {
            io.to(String(roomID)).emit("userLeft", userID);
        }
    }
    catch (error) {
        console.error(error);
    }
}


// ========== Discovery ==========

function OnSocketTryGetDiscovery(socket) {
    GetChatroomListFromDB(socket);
}

async function GetChatroomListFromDB(socket) {
    const requestOptions = {
        method: "GET",
        redirect: "follow"
    };

    fetch(String(process.env.API_URL) + "/rooms", requestOptions)
        .then((response) => response.text())
        .then((result) => socket.emit("receiveDiscovery", JSON.parse(result)))
        .catch((error) => console.error(error));
}

async function OnSocketTryJoinChatroom(socket, userID, roomID, password) {
    const cookies = parse(socket.handshake.headers.cookie);

    console.log(roomID + " " + password);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            room_id: roomID,
            password: password
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID + "/join", requestOptions);
        console.log(response);
        console.log(await response.json());

        if (response.ok) {
            socket.emit("redirectToRoom", roomID);
            OnSocketJoinChatroom(socket, userID, roomID);
        }
    }
    catch (error) {
        console.error(error);
    }
}

async function OnSocketJoinChatroom(socket, userID, roomID) {
    const callback = await OnSocketGetUserInfo(userID);

    if (callback.status === "OK") {
        // Udeluk gerne brugeren selv engang, men bedre ville være at få brugeren selv til at sende dette efter en ack fra server
        io.to(String(roomID)).emit("newUserJoined", userID, callback.payload);
    }
    else if (callback.message) {
        console.log(callback.message);
    }
}


// ========== Messages ==========

// Send new message to chatroom
async function OnNewMessageInChatroom(socket, userID, roomID, message) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            room_id: roomID,
            content: message
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/messages", requestOptions);

        if (response.ok) {
            const json = await response.json();

            io.to(String(roomID)).emit("newMessageRoom", json);
        }
    }
    catch (error) {

    }
}

async function OnSocketDeleteMessage(socket, roomID, messageID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            message_id: messageID
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/messages/" + messageID, requestOptions);

        if (response.ok) {
            const json = await response.json();

            io.to(String(roomID)).emit("messageDeleted", messageID, "[deleted by user]");
        }
    }
    catch (error) {

    }
}


// ========== Creating chatrooms ==========

async function OnSocketTryCreateChatroom(socket, userID, chatroomName, chatroomPW, isPrivate) {
    const cookies = parse(socket.handshake.headers.cookie);

    console.log(chatroomName + " " + isPrivate + " " + chatroomPW);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify ({
            name: chatroomName,
            is_private: isPrivate,
            password: chatroomPW
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms", requestOptions);

        if (response.ok) {
            const json = await response.json();

            OnSocketTryJoinChatroom(socket, userID, json.id, chatroomPW);
        }
        
    }
    catch (error) {
        console.error(error);
    }
}


// ========== MISC ==========

io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});

httpServer.listen(port);

Entry();

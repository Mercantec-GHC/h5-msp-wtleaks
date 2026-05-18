// node --env-file=.env server.js

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { serialize, parse } from "cookie";
import cookieParser from "cookie-parser";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { stat } from "node:fs";


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


app.patch("/user/update", async (req, res) => {
    const response = await ChangeUserInfo(req);

    if (response.ok) {
        const json = await response.json();
        
        res.cookie("access_token", json.access_token, { httpOnly: true });
        res.cookie("refresh_token", json.refresh_token, { httpOnly: true });
        //res.cookie("token_type", json.token_type, { httpOnly: true });

        res.status(response.status).send("Yay");
    }
    else {
        console.error(response);
        res.status(response.status).send("Nay");
    }
})


function Entry() {
    //console.log(process.env.DATABASE_URL);
}


// ========== Client management ==========

io.on("connection", (socket) => {
    // Account

    socket.on("tryRegister", async (username, displayname, password, callback) => {
        callback(await OnSocketTryRegister(socket, username, displayname, password));
    });

    socket.on("clientLogOut", async (callback) => {
        callback(await OnSocketClientLogOut(socket));
    });

    socket.on("changeDisplayName", async (newName, callback) => {
        callback(await ChangeUserDisplayName(socket, newName));
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
        OnSocketSendMessage(socket, userID, roomID, message);
    });

    socket.on("leaveChatroom", async (userID, roomID, callback) => {
        callback(await OnSocketLeaveChatroom(socket, userID, roomID));
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

// Når en bruger forsøger på at logge ind
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

        callback.status = response.ok ? "OK" : "NOK";
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
        callback.payload.message = "Unknown error";
    }

    return callback;
}

// Når en bruger gerne vil oprettes
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

        callback.status = response.ok ? "OK" : "NOK";
        callback.payload = json;
    }
    catch (error) {
        console.error(error.message);
        callback.status = "NOK";
        callback.payload = {};
        callback.payload.message = "Unknown error";
    }

    return callback;
}

// Den første handling, en bruger foretager sig. Hvis de ikke er logget ind, sendes de til loginsiden. Hvis de er, får de noget offentlig data om sig selv, som de gemmer på
async function OnSocketGetOwnInfo(socket) {
    let cookies;

    if (!socket.handshake.headers.cookie) {
        socket.emit("goToLogin");
        return;
    }

    try {
        cookies = parse(socket.handshake.headers.cookie);
    }
    catch (error) {
        socket.emit("goToLogin");
        return;
    }

    const requestOptions = {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/me", requestOptions);
        const json = await response.json();

        if (response.ok) {
            callback.status = "OK";
            callback.payload = json;

            socket.userID = json.id;
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
        callback.payload = {};
        callback.payload.message = "Serverfejl, prøv igen senere";
    }

    return callback;
}

async function ChangeUserDisplayName(socket, newName) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "PATCH",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            display_name: newName
        })
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/updateDisplay", requestOptions);

        callback.status = response.ok ? "OK" : "NOK";
    }
    catch (error) {
        console.error(error);
        callback.status = "NOK";
    }

    return callback;
}

async function ChangeUserInfo(req) {
    const reqJSON = req.body;
    const cookies = req.cookies;

    const requestOptions = {
        method: "PATCH",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            username: reqJSON.username,
            current_password: reqJSON.current_password,
            new_password: reqJSON.new_password
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/update", requestOptions);
        return response;
    }
    catch (error) {
        console.error(error);
    }
}


// ========== Chatroom ==========

// Når en bruger åbner chatvinduet. Sender en liste med de chatrum, brugeren er medlem af
async function SendRoomListToSocket(socket) {
    let cookies;

    try {
        cookies = parse(socket.handshake.headers.cookie);
    }
    catch (error) {
        socket.emit("goToLogin");
        return;
    }

    const requestOptions = {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/my", requestOptions);
        const json = await response.json();

        socket.emit("receiveRoomList", json);
    }
    catch (error) {
        console.error(error);
    }
}

// Når en bruger åbner et chatrum, de er medlem af. Sender rummets beskeder og brugerinfo
async function OnSocketTryEnterChatroom(socket, roomID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID, requestOptions);

        if (response.ok) {
            const json = await response.json();

            if (socket.activeRoomID !== -1) {
                socket.leave(String(socket.activeRoomID));
            }

            socket.activeRoomID = roomID;
            socket.join(String(roomID));

            socket.emit("receiveChatroom", json);
        }
    }
    catch (error) {
        console.error(error);
    }
}

// Når en bruger gerne vil have info om en anden bruger. Bruges primært til at vise information på brugere, der har efterladt beskeder i et chatrum, de ikke længere er medlem af
async function OnSocketGetUserInfo(userID) {
    const requestOptions = {
        method: "GET"
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/auth/users/" + userID, requestOptions);

        if (response.ok) {
            const json = await response.json();

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

// Når en bruger forsøger at sparke en anden bruger ud af et chatrum
async function OnSocketKickUser(socket, roomID, userID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID + "/users/" + userID, requestOptions);

        if (response.ok) {
            // I et mere optimalt system, vil de være en del af de her grupper uanset hvad
            //const sockets = await io.in(String(roomID)).fetchSockets();

            const sockets = await io.fetchSockets();
            const kickedSocket = sockets.find(s => s.userID === userID);

            if (kickedSocket !== undefined) {
                if (kickedSocket.activeRoomID === roomID) {
                    kickedSocket.leave(String(roomID));
                    kickedSocket.activeRoomID = -1;
                }

                kickedSocket.emit("kickedFromRoom", roomID);
            }

            io.to(String(roomID)).emit("userLeft", userID);
        }
    }
    catch (error) {
        console.error(error);
    }
}

async function OnSocketLeaveChatroom(socket, userID, roomID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    let callback = Object.create(null);

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID + "/leave", requestOptions);

        console.log(response);

        const json = await response.json();

        callback.status = response.ok ? "OK" : "NOK";
        callback.payload = json;

        if (response.ok) {
            const sockets = await io.fetchSockets();
            const leavingSocket = sockets.find(s => s.userID === userID);

            if (leavingSocket !== undefined) {
                if (leavingSocket.activeRoomID === roomID) {
                    leavingSocket.leave(String(roomID));
                    leavingSocket.activeRoomID = -1;
                }

                leavingSocket.emit("kickedFromRoom", roomID);
            }

            io.to(String(roomID)).emit("userLeft", userID);
        }
    }
    catch (error) {
        console.error(error);
        callback.status = "NOK";
        callback.payload = {};
        callback.payload.detail = "Serverfejl";
    }

    return callback;
}



// ========== Discovery ==========

// Når en bruger gerne vil have listen med offentlige chatrum
async function OnSocketTryGetDiscovery(socket) {
    const requestOptions = {
        method: "GET",
        redirect: "follow"
    };

    fetch(String(process.env.API_URL) + "/rooms", requestOptions)
        .then((response) => response.text())
        .then((result) => socket.emit("receiveDiscovery", JSON.parse(result)))
        .catch((error) => console.error(error));
}

// Når en bruger forsøger at deltage i et chatrum, som de ikke allerede er medlem af
async function OnSocketTryJoinChatroom(socket, userID, roomID, password) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
            password: password
        })
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/rooms/" + roomID + "/join", requestOptions);

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
        console.error(callback.message);
    }
}


// ========== Messages ==========

// Når en bruger vil sende en ny besked i et chatrum
async function OnSocketSendMessage(socket, userID, roomID, message) {
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
        console.error(error);
    }
}

// Når en bruger vil slette en besked
async function OnSocketDeleteMessage(socket, roomID, messageID) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + cookies.access_token
        }
    };

    try {
        const response = await fetch(String(process.env.API_URL) + "/messages/" + messageID, requestOptions);

        if (response.ok) {
            const json = await response.json();

            let reasoning;

            if (json.type === "user") {
                reasoning = "[deleted by user]";
            }
            else if (json.type === "admin") {
                reasoning = "[deleted by admin]";
            }
            else {
                reasoning = "[deleted]";
            }

            io.to(String(roomID)).emit("messageDeleted", messageID, reasoning);
        }
    }
    catch (error) {
        console.error(error);
    }
}


// ========== Creating chatrooms ==========

// Når en bruger vil forsøge at oprette et nyt chatrum
async function OnSocketTryCreateChatroom(socket, userID, chatroomName, chatroomPW, isPrivate) {
    const cookies = parse(socket.handshake.headers.cookie);

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Authorization": "Bearer " + cookies.access_token
        },
        body: JSON.stringify({
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

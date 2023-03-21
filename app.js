try {
  // Trengs på localhost, fungerer ikke på server (render)
  require("dotenv").config();
} catch {}
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const fs = require("fs");
const filename = "./token.json";

const app = express();
const port = process.env.PORT || 3000;
let lastFetched;

app.use(function (req, res, next) {
  const allowedOrigins = ["http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-credentials", true);
  res.header("Access-Control-Allow-Methods", "GET");
  next();
});
let stravadata;
let data = {};

function startInterval() {
  setInterval(async () => {
    try {
      await getStrava();
    } catch {
      console.log("Error getting strava info");
    }
    if (data.expires_at < Date.now() / 1000) {
      await refreshToken().then();
    } else {
    }
  }, 1000 * 60 * 5);
}

async function getStrava() {
  if (data.expires_at < Date.now() / 1000) {
    await refreshToken().then();
  }
  await fetch(
    "https://www.strava.com/api/v3/clubs/1118846/activities?access_token=" +
      data.access_token
  )
    .then((res) => res.json())
    .then((json) => {
      stravadata = formatStravaData(json);
    });
}

function formatStravaData(data) {
  let res = [];
  let indexes = {};
  console.log("Formatting data");
  try {
    data.forEach((d) => {
      if (
        Object.keys(indexes).includes(
          d.athlete.firstname + " " + d.athlete.lastname
        )
      ) {
        res[indexes[d.athlete.firstname + " " + d.athlete.lastname]].total +=
          Math.round(Number(d.distance));
      } else {
        indexes[d.athlete.firstname + " " + d.athlete.lastname] = res.length;
        let athlete = {
          firstname: d.athlete.firstname,
          lastname: d.athlete.lastname,
          total: 0,
        };
        res.push(athlete);
        res[indexes[d.athlete.firstname + " " + d.athlete.lastname]].total =
          Math.round(Number(d.distance));
      }
    });
  } catch {
    console.log("Error");
  }
  return res;
}

function logTokens() {
  console.log("Access Token: " + data.access_token);
  console.log("Refresh Token: " + data.refresh_token);
  console.log("Expires At: " + data.expires_at);
  console.log("------------");
}

async function refreshToken() {
  console.log(
    data.client_id +
      " " +
      data.client_secret +
      " " +
      data.refresh_token +
      " " +
      "refresh_token"
  );
  return await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: data.client_id,
      client_secret: data.client_secret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  })
    .then((res) => res.json())
    .then((r) => {
      if (r.access_token) {
        data.access_token = r.access_token;
        data.refresh_token = r.refresh_token;
        data.expires_at = r.expires_at;

        logTokens();
      } else {
        console.log("FAILED TO REFRESH TOKENS");
      }

      return data;
    });
}

async function saveToFile(data) {
  fs.writeFile(filename, JSON.stringify(data), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Saved to file");
    }
  });
}

app.get("/", (req, res) => {
  if (Date.now() - lastFetched > 1000 * 60) {
    getStrava().then(() => {
      lastFetched = Date.now();
      res.send(stravadata);
    });
  } else {
    res.send(stravadata);
  }
});

app.listen(port, () => {
  fs.readFile(filename, "utf8", async (err, result) => {
    if (err) {
      console.error(err);
      return;
    }
    lastFetched = 0;
    result = JSON.parse(result);
    if (result.access_token) {
      console.log("-----------\nGot secrets from file: ");
      console.log(result);
      console.log("-----------");
      data.access_token = result.access_token;
      data.refresh_token = result.refresh_token;
      data.expires_at = result.expires_at;
      data.client_secret = result.client_secret;
      data.client_id = result.client_id;
    } else {
      console.log("--------\nGot secrets from env: ");

      console.log("Access:" + process.env.ACCESS_TOKEN);
      console.log("Refresh: " + process.env.REFRESH_TOKEN);
      console.log("Exp at:" + process.env.EXPIRES_AT);
      console.log("Client id: " + process.env.CLIENT_ID);
      console.log("Client secret" + process.env.CLIENT_SECRET);
      console.log("-----------");
      data.access_token = process.env.ACCESS_TOKEN;
      data.refresh_token = process.env.REFRESH_TOKEN;
      data.expires_at = process.env.EXPIRES_AT;
      data.client_secret = process.env.CLIENT_SECRET;
      data.client_id = process.env.CLIENT_ID;
    }

    saveToFile(data).then(
      refreshToken().then(getStrava()).then(startInterval())
    );
  });

  console.log(`Port: ${port}`);
});

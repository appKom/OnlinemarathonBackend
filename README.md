# OnlineMaraton
Kan enkelt hostes på render.com


### Setup
* Set opp en mongoDB og lag en entry som følger TokenModel.js, med access_token, refresh_token og expires_at=0
    * Refesh og access token hentes fra https://www.strava.com/settings/api

* Legg inn CLIENT_SECRET, CLIENT_ID, DATABASE_URL i .env,         
    * Client_secret og -id hentes fra https://www.strava.com/settings/api

```
.env

CLIENT_SECRET=""
CLIENT_ID=""
DATABASE_URL=""
CLUB_ID=""
```

### Run
Start med ` node app.js`

### Annen info
* Formatert data fra strava hentes fra `GET /data` 
* Data oppdateres hvert 120 sekund (Kan endres hvis strava tillater høyere antall requests per dag i fremtiden)

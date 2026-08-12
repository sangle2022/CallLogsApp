# Setup: Zoho CRM connection via Catalyst

## 1. Files added/changed

```
call_logs_app_backend_function/
├── index.js                       # REPLACED - router with auth + 2 endpoints
├── config/env.js                  # NEW - reads & validates env vars
├── services/
│   ├── zohoTokenManager.js        # NEW - OAuth token fetch/cache
│   └── zohoCrmClient.js           # NEW - generic CRM insert (batched, retries once on 401)
├── handlers/
│   ├── callLogsHandler.js         # NEW - POST /call-logs
│   └── callRecordingsHandler.js   # NEW - POST /call-recordings
├── mapping/fieldMapping.js        # NEW - EDIT THIS once your custom modules exist
└── utils/
    ├── httpUtils.js               # NEW - body parsing + response helpers
    └── logger.js                  # NEW
```

No npm dependencies required — uses Node's built-in `fetch` (Catalyst's
Node 18+ runtime supports it natively).

## 2. Generate a Zoho refresh token (one-time)

1. Go to https://api-console.zoho.com -> create a **Server-based Application**.
2. Note the Client ID and Client Secret.
3. Get consent + an authorization code by visiting (in a browser, logged into the CRM account):
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.ALL&client_id=YOUR_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=YOUR_REDIRECT_URI
   ```
4. Exchange the returned `code` for a refresh token:
   ```
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "redirect_uri=YOUR_REDIRECT_URI" \
     -d "code=THE_CODE_FROM_STEP_3"
   ```
   The response's `refresh_token` does not expire (unless revoked) — save it securely.

## 3. Set environment variables in Catalyst

Catalyst Console → your project → Functions → `call_logs_app_backend_function` → Environment Variables:

| Key | Example |
|---|---|
| `ZOHO_DC` | `com` (or `in`, `eu`, `com.au`, `jp` — match your CRM account's region) |
| `ZOHO_CLIENT_ID` | from API Console |
| `ZOHO_CLIENT_SECRET` | from API Console |
| `ZOHO_REFRESH_TOKEN` | from step 2 above |
| `ZOHO_CRM_CALL_LOGS_MODULE` | e.g. `Call_Logs` (your custom module's API name) |
| `ZOHO_CRM_CALL_RECORDINGS_MODULE` | e.g. `Call_Recordings` |
| `MOBILE_API_KEY` | any long random string — the mobile app sends this back in `X-API-Key` |

## 4. Once your custom modules exist in CRM

Open `mapping/fieldMapping.js` and update the **left-hand side** field
names (`Caller_Name`, `Phone_Number`, etc.) to match the field API names
Zoho CRM generated for your module (Setup → Modules → your module → Fields).
No other file needs to change.

## 5. Request/response contract

**POST `/call-logs`**
```json
// Request
{ "logs": [ { "id": "1", "callerName": "John", "phoneNumber": "+1234567890",
              "callType": "INCOMING", "duration": 65, "timestamp": 1733820000000,
              "dateTime": "Aug 10, 2026, 4:00 PM" } ] }

// Response
{ "success": true, "data": { "received": 1, "inserted": 1, "skipped": [], "failed": [] } }
```

**POST `/call-recordings`**
```json
// Request
{ "recordings": [ { "id": "rec-1", "fileName": "call_123.mp3",
                     "filePath": "/storage/emulated/0/Call/call_123.mp3",
                     "fileSize": 245000, "createdDate": 1733820000000,
                     "extension": "mp3" } ] }

// Response
{ "success": true, "data": { "received": 1, "inserted": 1, "skipped": [], "failed": [] } }
```

Both endpoints require header: `X-API-Key: <MOBILE_API_KEY value>`.

## 6. Deploy & test

```
catalyst deploy
curl -X POST https://<your-catalyst-domain>/server/call_logs_app_backend_function/call-logs \
  -H "X-API-Key: <your key>" \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"id":"1","callerName":"Test","phoneNumber":"+911234567890","callType":"INCOMING","duration":30,"timestamp":1733820000000}]}'
```

## Next step (not included yet, by design)

Uploading the actual recording **audio file** into CRM as an attachment
is a separate API call (multipart `Upload Attachment`) with a different
request shape than JSON metadata. Once metadata sync is confirmed
working end-to-end, this can be added as its own function/endpoint
without touching the code here.

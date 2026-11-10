| No | Situation | Method + Path | Success Status | Notes | 
|---|---|---|---|---|
| 1 | Health Check | GET /health | 200 | Simple Ping to check whter we connect to ther server or not |
| 2 | Upload Raw Excel | POST /submission | 202 | After save the raw excel into the server, the server return response with combination of header and body that contain job_id and Location so the application can tract the uploaded raw excel |
| 3 | Check Job Status | GET /jobs/{id} | 200 | Polling endpoint, get the job status |
| 4 | List submission | GET /submissions | 200 | to get previous submission list so the user can track what they submitted |
| 5 | Get submission detail | GET /Submissions/{id} | 200 OK |  Used by review screen to fetch detailed for specific submission |
| 6 | Accept/Reject Proposal | POST /Submission/{id}/decisioin |  | Submit the user decision back to the server about the proposal. Containing the verdict similarity score, reasoning and incoming schema card |
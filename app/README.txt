SHANTI JEWELLERS - COMPLETE WEB APP (no Claude / no cloud needed, free)
=====================================================================
Needs only Node.js 16+ (https://nodejs.org). No npm install.

RUN
  Windows: double-click start.bat   (or in VS Code terminal: node server.js)
  Open http://localhost:3000

ADMIN
  Footer -> "Admin Login". Default ID: shanti  Password: Shanti@2026
  Admin can ADD, EDIT and DELETE items (name, category, weight, photo).
  Customers see all items; the enquiry form sends to WhatsApp 6392615114.

CHANGE PASSWORD (do this!)
  PowerShell: $env:ADMIN_ID="myid"; $env:ADMIN_PASS="MyStrong#Pass1"; node server.js
  or edit ADMIN_ID / ADMIN_PASS at the top of server.js.

DATABASE
  data/items.json (details) + data/uploads/ (photos). Back up the data folder.

SHOW TO PUBLIC FROM VS CODE
  Ports tab -> Forward a Port -> 3000 -> right-click -> Port Visibility: Public.
  Works only while your PC and server are running.
  For 24x7: use a VPS or Node host with a persistent disk for the data folder.

GITHUB
  .gitignore keeps your data/ folder out of git.

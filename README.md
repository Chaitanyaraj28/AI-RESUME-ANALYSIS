# AI-RESUME-ANALYSIS
ResumeIQ Deploy

Frontend: GitHub Pages

Push the contents of this folder to your GitHub repository.
In GitHub, open Settings -> Pages.
Set the publishing source to the branch/folder that contains this frontend.
Keep .nojekyll in the published folder so GitHub Pages serves the files directly.
GitHub Pages is static hosting, so it can serve index.html, styles.css, app.js, and config.js, but it cannot run the Python backend. GitHub Docs describe Pages as a static hosting service for HTML, CSS, and JavaScript files.

Backend: Render

Create a new Render Web Service from the same repository.
Point Render at this folder and use the included render.yaml, or create the service manually with:
Root Directory: backend
Runtime: Python
Build Command: pip install -r requirements.txt
Start Command: python app.py
Add the secret environment variable ANTHROPIC_API_KEY in the Render dashboard.
After Render gives you a URL like https://your-service.onrender.com, open config.js.
Replace https://your-render-service.onrender.com/api/analyze with your real Render API URL.
Commit that config.js change and republish GitHub Pages.
Render Docs note that public web services must bind to 0.0.0.0 and use the PORT environment variable. This backend already does that.

Result

GitHub Pages hosts the UI.
Render hosts the backend API.
The frontend calls your Render URL from config.js.

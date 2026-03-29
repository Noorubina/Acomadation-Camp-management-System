# Deploying React Frontend on Render as a Static Site

This guide explains how to deploy the React frontend located in the `frontend/` directory as a Static Site on Render.

## Steps to Deploy

1. **Create a New Static Site on Render**
   - Go to your Render dashboard.
   - Click on **New** → **Static Site**.

2. **Connect Your GitHub Repository**
   - Select the repository containing your project.

3. **Configure the Static Site Settings**
   - **Name:** Choose a unique name for your frontend site (e.g., `naajco-camp-frontend`).
   - **Branch:** Select the branch to deploy (e.g., `master` or `main`).
   - **Root Directory:** Set this to `frontend` (since your React app is inside the `frontend/` folder).
   - **Build Command:** Use `npm install && npm run build`
   - **Publish Directory:** Set this to `frontend/dist` (Vite outputs build files to `dist` by default).

4. **Set Environment Variables (if needed)**
   - If your frontend requires environment variables (e.g., API URLs), add them here.

5. **Deploy**
   - Click **Create Static Site**.
   - Render will build and deploy your React frontend.

## Notes

- Your React app uses Vite, which outputs the production build to the `dist` folder.
- Make sure your backend API URL is correctly set in the frontend environment variables or code.
- After deployment, your frontend will be accessible via the Render-generated URL.

---

If you want, I can help you create a Render Static Site configuration file or assist with environment variables setup for the frontend deployment.

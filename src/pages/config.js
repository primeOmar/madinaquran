export const REDIRECT_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5173/Congratulations"
    : "https://madinaquranclass.onrender.com/Congratulations";

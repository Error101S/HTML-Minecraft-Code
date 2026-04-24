import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = { /* your config */ };

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

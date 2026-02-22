// Загружается первым — до app и config
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env в корне проекта (server/src -> ../../ = project root)
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

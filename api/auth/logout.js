// POST /api/auth/logout
import { route, send, clearSessionCookie } from "../_lib/http.js";
export default route({ POST: async (_req, res) => { clearSessionCookie(res); send(res, 200, { ok: true }); } });

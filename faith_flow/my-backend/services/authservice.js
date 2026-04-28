// ==================== services/authService.js ====================
const pool = require("../config/database");
const admin = require("../config/firebase");

async function upsertUser(userData) {
  const { firebaseUid, displayName, photoUrl } = userData;
  
  const sql = `
    INSERT INTO "user" (firebase_uid, user_name, user_pic, join_time)
    VALUES ($1, $2, $3, CURRENT_DATE)
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_pic   = EXCLUDED.user_pic
    RETURNING "userID", firebase_uid, user_name, user_pic, join_time;
  `;
  
  const result = await pool.query(sql, [firebaseUid, displayName, photoUrl]);
  return result.rows[0];
}

async function importAllFirebaseUsers() {
  let imported = 0;
  let nextPageToken = undefined;
  
  console.log("[importAllFirebaseUsers] ?ãÂ??πÊ¨°?ØÂÖ•...");
  
  while (true) {
    const batch = await admin.auth().listUsers(1000, nextPageToken);
    
    console.log(`[importAllFirebaseUsers] ?ïÁ? ${batch.users.length} ‰Ωç‰Ωø?®ËÄÖ`);
    
    for (const user of batch.users) {
      const firebaseUid = user.uid;
      const displayName = user.displayName || user.email || "New User";
      const photoUrl = user.photoURL || null;
      
      try {
        await pool.query(
          `
          INSERT INTO "user" (firebase_uid, user_name, user_pic, join_time)
          VALUES ($1, $2, $3, CURRENT_DATE)
          ON CONFLICT (firebase_uid)
          DO UPDATE SET
            user_name = EXCLUDED.user_name,
            user_pic   = EXCLUDED.user_pic
          `,
          [firebaseUid, displayName, photoUrl]
        );
        
        imported++;
      } catch (error) {
        console.error(`[importAllFirebaseUsers] ?ØÂÖ•‰ΩøÁî®?ÖÂ§±??(${firebaseUid}):`, error.message);
      }
    }
    
    nextPageToken = batch.pageToken;
    if (!nextPageToken) break;
  }
  
  console.log(`[importAllFirebaseUsers] ÂÆåÊ?ÔºÅÂÖ±?ØÂÖ• ${imported} ‰Ωç‰Ωø?®ËÄÖ`);
  return imported;
}

async function getAllUsers(limit = 50) {
  const result = await pool.query(
    `SELECT "userID", firebase_uid, user_name, user_pic, join_time
     FROM "user"
     ORDER BY "userID" DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = {
  upsertUser,
  importAllFirebaseUsers,
  getAllUsers
};

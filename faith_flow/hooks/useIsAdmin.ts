import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { setIsAdmin(false); return; }
      user.getIdToken()
        .then((token) =>
          fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
        .then((res) => res.json())
        .then((data) => { if (data.ok) setIsAdmin(data.data.is_admin === true); })
        .catch(() => {});
    });
    return unsubscribe;
  }, []);

  return isAdmin;
}

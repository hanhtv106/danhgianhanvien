const API_URL = "";

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  
  if (response.status === 401 && endpoint !== "/api/login") {
    console.warn("Session expired or invalid token. Clearing session.");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Use a small delay before reload to ensure storage is cleared
    setTimeout(() => {
      window.location.href = "/";
    }, 100);
    throw new Error("Phiên đăng nhập hết hạn");
  }
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Có lỗi xảy ra");
  }
  return response.json();
};

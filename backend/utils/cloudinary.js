import crypto from "node:crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "vqbfbti0";
const API_KEY = process.env.CLOUDINARY_API_KEY || "253986657213176";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "TcWhw64NWDnQmMUWmCFC4ocQTQk";

/**
 * Uploads a base64 string, image URL, or binary buffer to Cloudinary CDN
 * @param {string} fileOrBase64 - Base64 image data (data:image/png;base64,...) or image URL
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<string>} Secure Cloudinary CDN URL
 */
export async function uploadToCloudinary(fileOrBase64, folder = "zenflow") {
  if (!fileOrBase64 || typeof fileOrBase64 !== "string") return null;

  const trimmed = fileOrBase64.trim();
  // If it's already a hosted Cloudinary or HTTPS URL, no need to re-upload
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    // Cloudinary signed params in alphabetical order
    const signatureParams = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash("sha1").update(signatureParams).digest("hex");

    const formData = new FormData();
    formData.append("file", trimmed);
    formData.append("api_key", API_KEY);
    formData.append("timestamp", String(timestamp));
    formData.append("folder", folder);
    formData.append("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Cloudinary API error:", errText);
      return trimmed; // Fallback to raw base64 if network issue
    }

    const data = await res.json();
    return data.secure_url || data.url || trimmed;
  } catch (err) {
    console.error("Cloudinary upload exception:", err.message);
    return trimmed;
  }
}

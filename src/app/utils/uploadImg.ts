import axios from "axios";
import { imgbbConfig } from "../../config/imgbb";

export const uploadToImgbb = async (imageBase64: string) => {
  if (!imgbbConfig.apiKey) throw new Error("ImgBB API key not set");

  const formData = new URLSearchParams();
  formData.append("image", imageBase64);

  const response = await axios.post(`${imgbbConfig.endpoint}?key=${imgbbConfig.apiKey}`, formData);
  
  if (response.data && response.data.data && response.data.data.url) {
    return response.data.data.url;
  }

  throw new Error("Failed to upload image to ImgBB");
};
"use client";
import axios from "axios";
import { useEffect } from "react";

export default function AxiosSetup() {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_STRAPI_API_TOKEN;
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, []);
  return null;
}

import axios from 'axios';

const TOKEN = process.env.SUNAT_API_TOKEN; 

export const consultarRucSunat = async (ruc: string) => {
  try {
    const url = `https://api.decolecta.com/v1/sunat/ruc/full`;
    
    console.log(`📡 Consultando RUC: ${ruc}...`);

    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
      params: { numero: ruc }
    });

    // --- AGREGADO: IMPRIMIR RESPUESTA EN CONSOLA ---
    console.log("📦 RESPUESTA DECOLECTA:", JSON.stringify(response.data, null, 2));
    // -----------------------------------------------

    const data = response.data.data || response.data;
    return data;

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
        console.error("❌ Error API:", error.response?.status, error.response?.data);
    } else {
        console.error("❌ Error desconocido:", error);
    }
    return null;
  }
};
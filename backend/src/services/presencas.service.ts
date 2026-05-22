import axios from "axios";

const API_URL = "http://localhost:3001/api/presencas";

export async function buscarPresencasTurma(turmaId: string) {
  const response = await axios.get(`${API_URL}/turma/${turmaId}`);

  return response.data;
}

export async function salvarPresenca(data: any) {
  const response = await axios.post(API_URL, data);

  return response.data;
}

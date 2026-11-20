/**
 * Utilitários Oficiais PIX do Banco Central do Brasil (EMV BR Code)
 * Implementação padrão com cálculo de CRC-16 (Polinômio 0x1021)
 */

function calcCRC16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEMV(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePixPayload({ key = 'financeiro@docentepro.com.br', name = 'DOCENTEPRO SAAS', city = 'SAO PAULO', amount, txid = 'DP100' }) {
  const cleanName = (name || 'DOCENTEPRO SAAS').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, 25);
  const cleanCity = (city || 'SAO PAULO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, 15);
  const cleanKey = (key || 'financeiro@docentepro.com.br').trim();
  const cleanTxid = (txid || 'DP100').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'DP100';

  const merchantAccount = formatEMV('00', 'BR.GOV.BCB.PIX') + formatEMV('01', cleanKey);

  let payload = 
    formatEMV('00', '01') +
    formatEMV('26', merchantAccount) +
    formatEMV('52', '0000') +
    formatEMV('53', '986');

  if (amount && Number(amount) > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    payload += formatEMV('54', formattedAmount);
  }

  payload += 
    formatEMV('58', 'BR') +
    formatEMV('59', cleanName) +
    formatEMV('60', cleanCity) +
    formatEMV('62', formatEMV('05', cleanTxid)) +
    '6304';

  const crc = calcCRC16(payload);
  return payload + crc;
}

function getPixQrCodeUrl(payload) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
}

module.exports = {
  calcCRC16,
  formatEMV,
  generatePixPayload,
  getPixQrCodeUrl
};

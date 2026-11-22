// ===================== CONFIRM MODAL =====================
function openConfirm(text, onOk) {
  document.getElementById('confirmModalText').textContent = text;
  document.getElementById('confirmModalOverlay').style.display = 'flex';
  confirmCallback = onOk;
}
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
  document.getElementById('confirmModalOverlay').style.display = 'none';
  confirmCallback = null;
});
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  document.getElementById('confirmModalOverlay').style.display = 'none';
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});

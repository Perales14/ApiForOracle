#!/usr/bin/env bash
set -euo pipefail
# change_ssh_port.sh
# Uso: ./change_ssh_port.sh 22
# Hace: hace backup de sshd_config, cambia el Port, valida con sshd -t, reinicia ssh y ajusta ufw.

NEWPORT="${1:-22}"
CONFIG="/etc/ssh/sshd_config"
BACKUP_DIR="/tmp/sshd_backups"
TIMESTAMP="$(date +%s)"
BACKUP="${BACKUP_DIR}/sshd_config.backup.${TIMESTAMP}"
LOG="/tmp/change_ssh_port.${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}"

echo "Inicio change_ssh_port.sh - puerto -> ${NEWPORT}" | tee "${LOG}"

run_cmd() {
  # Ejecuta con sudo si no somos root
  if [ "$(id -u)" -ne 0 ]; then
    echo "Usando sudo para: $*" | tee -a "${LOG}"
    sudo bash -c "$*"
  else
    bash -c "$*"
  fi
}

# 1) backup
echo "Haciendo backup a ${BACKUP}" | tee -a "${LOG}"
run_cmd "cp -p ${CONFIG} ${BACKUP}"

# 2) cambiar/insertar linea Port
# Si existe una linea Port ... la reemplaza, si no, agrega al final
echo "Modificando ${CONFIG} para usar Port ${NEWPORT}" | tee -a "${LOG}"
run_cmd "grep -E '^[[:space:]]*Port[[:space:]]+' ${CONFIG} >/dev/null 2>&1 && sed -i -E 's/^[[:space:]]*Port[[:space:]]+.*/Port ${NEWPORT}/g' ${CONFIG} || echo -e \"\nPort ${NEWPORT}\" >> ${CONFIG}"

# 3) validar config
echo "Validando configuración sshd..." | tee -a "${LOG}"
if run_cmd "sshd -t" >/dev/null 2>&1; then
  echo "sshd -t OK" | tee -a "${LOG}"
else
  echo "sshd -t FALLÓ. Restaurando backup." | tee -a "${LOG}"
  run_cmd "cp -p ${BACKUP} ${CONFIG}"
  exit 1
fi

# 4) reiniciar servicio ssh
echo "Reiniciando servicio ssh" | tee -a "${LOG}"
# pruebas: systemctl restart ssh o sshd según distro
if run_cmd "systemctl restart ssh" >/dev/null 2>&1; then
  echo "systemctl restart ssh OK" | tee -a "${LOG}"
elif run_cmd "systemctl restart sshd" >/dev/null 2>&1; then
  echo "systemctl restart sshd OK" | tee -a "${LOG}"
else
  echo "No se pudo reiniciar con systemctl. Intentando service restart..." | tee -a "${LOG}"
  run_cmd "service ssh restart" || run_cmd "service sshd restart"
fi

# 5) abrir en UFW (si instalado)
echo "Intentando permitir puerto ${NEWPORT} en ufw (si existe)" | tee -a "${LOG}"
if run_cmd "command -v ufw >/dev/null 2>&1 && ufw status >/dev/null 2>&1"; then
  run_cmd "ufw allow ${NEWPORT}/tcp || true"
  run_cmd "ufw reload || true"
  echo "ufw actualizado" | tee -a "${LOG}"
else
  echo "ufw no encontrado o no activo" | tee -a "${LOG}"
fi

# 6) comprobación final: escucha en el puerto?
echo "Comprobando que sshd escucha en ${NEWPORT}" | tee -a "${LOG}"
if run_cmd "ss -tln | grep -q :${NEWPORT}"; then
  echo "sshd escucha en ${NEWPORT}" | tee -a "${LOG}"
echo "FIN OK" | tee -a "${LOG}"
exit 0

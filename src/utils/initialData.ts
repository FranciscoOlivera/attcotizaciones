import { DevicePriceRecord } from '../types/pricing';

/**
 * Returns empty records by default when no table or email has been linked yet,
 * as requested: "si no tienes ninguna tabla vinculada o ningun correo no pongas ningún precio de plan ni nada de eso"
 */
export const getInitialCentralRecords = (): DevicePriceRecord[] => {
  return [];
};

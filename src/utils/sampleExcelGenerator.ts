import * as XLSX from 'xlsx';

export const createSampleATTExcelBuffer = (): { buffer: ArrayBuffer; filename: string } => {
  const wb = XLSX.utils.book_new();

  // 1. Unused sheet: "Portada y Políticas" (will be discarded to save space)
  const portadaData = [
    ['AT&T MÉXICO - DIRECCIÓN COMERCIAL'],
    ['DOCUMENTO CONFIDENCIAL - LISTA DE PRECIOS Y PROMOCIONES'],
    ['Vigencia:', 'Septiembre 2026'],
    ['Nota:', 'Esta hoja no contiene precios de equipos.'],
  ];
  const wsPortada = XLSX.utils.aoa_to_sheet(portadaData);
  XLSX.utils.book_append_sheet(wb, wsPortada, 'Portada y Políticas');

  // 2. TARGET SHEET: "Promociones AT&T Premium"
  // Row 1: Plan Names (Azul 1, Azul 2, Azul 3, Plata, Oro, Black, Platino, Diamante)
  // Row 2: Plan Base Monthly Price (precio únicamente del plan, ubicado en la celda de abajo)
  // Row 3: Plazos (24m, 30m, 36m)
  // Rows 4+: Full equipment catalog
  const planNames = ['Azul 1', 'Azul 2', 'Azul 3', 'Plata', 'Oro', 'Black', 'Platino', 'Diamante'];
  
  // Row 1: Headers
  const row1: (string | number)[] = ['Marca', 'Equipo / Modelo', 'Capacidad'];
  planNames.forEach((name) => {
    row1.push(name, '', '');
  });

  // Row 2: Plan Base Monthly Price (directly under each plan)
  // (Azul 1: 299, Azul 2: 399, Azul 3: 499, Plata: 599, Oro: 799, Black: 999, Platino: 1299, Diamante: 1599)
  const row2: (string | number)[] = ['', '', ''];
  const defaultPlanPrices: Record<string, number> = {
    'Azul 1': 299,
    'Azul 2': 399,
    'Azul 3': 499,
    'Plata': 599,
    'Oro': 799,
    'Black': 999,
    'Platino': 1299,
    'Diamante': 1599,
  };
  planNames.forEach((name) => {
    const p = defaultPlanPrices[name] || 500;
    row2.push(p, p, p);
  });

  // Row 3: Plazos
  const row3: (string | number)[] = ['Marca', 'Modelo', 'Capacidad'];
  planNames.forEach(() => {
    row3.push('24m', '30m', '36m');
  });

  // Full Catalog of 30+ Equipment Models
  interface RawDevice {
    brand: string;
    model: string;
    storage: string;
    basePrice: number;
    black36mSpecial?: number; // Special promotional price if specified
  }

  const rawDevices: RawDevice[] = [
    // EXACT MODEL AND PRICE FROM USER:
    { brand: 'Apple', model: 'iPhone 18 Pro Max 256GB', storage: '256GB', basePrice: 32999, black36mSpecial: 28690.30 },
    { brand: 'Apple', model: 'iPhone 18 Pro 128GB', storage: '128GB', basePrice: 28999 },
    { brand: 'Apple', model: 'iPhone 18 Plus 256GB', storage: '256GB', basePrice: 26999 },
    { brand: 'Apple', model: 'iPhone 18 128GB', storage: '128GB', basePrice: 22999 },
    { brand: 'Apple', model: 'iPhone 16 Pro Max 256GB', storage: '256GB', basePrice: 30999 },
    { brand: 'Apple', model: 'iPhone 16 Pro 128GB', storage: '128GB', basePrice: 25999 },
    { brand: 'Apple', model: 'iPhone 16 Plus 128GB', storage: '128GB', basePrice: 22999 },
    { brand: 'Apple', model: 'iPhone 16 128GB', storage: '128GB', basePrice: 19999 },
    { brand: 'Apple', model: 'iPhone 15 128GB', storage: '128GB', basePrice: 16499 },
    { brand: 'Apple', model: 'iPhone 14 128GB', storage: '128GB', basePrice: 13999 },
    
    // Samsung
    { brand: 'Samsung', model: 'Galaxy S24 Ultra 256GB', storage: '256GB', basePrice: 28999 },
    { brand: 'Samsung', model: 'Galaxy S24+ 256GB', storage: '256GB', basePrice: 22499 },
    { brand: 'Samsung', model: 'Galaxy S24 128GB', storage: '128GB', basePrice: 18499 },
    { brand: 'Samsung', model: 'Galaxy Z Fold 6 256GB', storage: '256GB', basePrice: 36999 },
    { brand: 'Samsung', model: 'Galaxy Z Flip 6 256GB', storage: '256GB', basePrice: 24999 },
    { brand: 'Samsung', model: 'Galaxy S23 FE 128GB', storage: '128GB', basePrice: 12999 },
    { brand: 'Samsung', model: 'Galaxy A55 5G 256GB', storage: '256GB', basePrice: 8999 },
    { brand: 'Samsung', model: 'Galaxy A35 5G 128GB', storage: '128GB', basePrice: 6999 },
    { brand: 'Samsung', model: 'Galaxy A25 5G 128GB', storage: '128GB', basePrice: 4999 },
    { brand: 'Samsung', model: 'Galaxy A15 128GB', storage: '128GB', basePrice: 3699 },

    // Motorola
    { brand: 'Motorola', model: 'Motorola Edge 50 Ultra 512GB', storage: '512GB', basePrice: 19999 },
    { brand: 'Motorola', model: 'Motorola Edge 50 Pro 512GB', storage: '512GB', basePrice: 12999 },
    { brand: 'Motorola', model: 'Motorola Edge 50 Fusion 256GB', storage: '256GB', basePrice: 6999 },
    { brand: 'Motorola', model: 'Moto G85 5G 256GB', storage: '256GB', basePrice: 4999 },
    { brand: 'Motorola', model: 'Moto G54 5G 128GB', storage: '128GB', basePrice: 3499 },
    { brand: 'Motorola', model: 'Moto G24 Power 256GB', storage: '256GB', basePrice: 2999 },

    // Xiaomi
    { brand: 'Xiaomi', model: 'Xiaomi 14T Pro 512GB', storage: '512GB', basePrice: 16999 },
    { brand: 'Xiaomi', model: 'Xiaomi 14T 256GB', storage: '256GB', basePrice: 12999 },
    { brand: 'Xiaomi', model: 'Redmi Note 13 Pro+ 5G 256GB', storage: '256GB', basePrice: 8999 },
    { brand: 'Xiaomi', model: 'Redmi Note 13 5G 256GB', storage: '256GB', basePrice: 5499 },
    { brand: 'Xiaomi', model: 'Redmi 13C 128GB', storage: '128GB', basePrice: 2999 },

    // Google Pixel
    { brand: 'Google', model: 'Pixel 9 Pro XL 256GB', storage: '256GB', basePrice: 26999 },
    { brand: 'Google', model: 'Pixel 9 Pro 128GB', storage: '128GB', basePrice: 23999 },
    { brand: 'Google', model: 'Pixel 9 128GB', storage: '128GB', basePrice: 18999 },
    { brand: 'Google', model: 'Pixel 8a 128GB', storage: '128GB', basePrice: 10999 },

    // Honor
    { brand: 'Honor', model: 'Honor Magic 6 Pro 512GB', storage: '512GB', basePrice: 24999 },
    { brand: 'Honor', model: 'Honor 200 Pro 512GB', storage: '512GB', basePrice: 14999 },
    { brand: 'Honor', model: 'Honor 200 256GB', storage: '256GB', basePrice: 10999 },
    { brand: 'Honor', model: 'Honor Magic 6 Lite 256GB', storage: '256GB', basePrice: 6999 },

    // OPPO & Vivo
    { brand: 'OPPO', model: 'OPPO Reno 12 Pro 512GB', storage: '512GB', basePrice: 13999 },
    { brand: 'OPPO', model: 'OPPO Reno 12 256GB', storage: '256GB', basePrice: 9999 },
    { brand: 'Vivo', model: 'Vivo V30 5G 256GB', storage: '256GB', basePrice: 10999 },
  ];

  const planDiscounts: Record<string, number> = {
    'Azul 1': 0,
    'Azul 2': 400,
    'Azul 3': 800,
    'Plata': 1400,
    'Oro': 2200,
    'Black': 3200,
    'Platino': 4200,
    'Diamante': 5200,
  };

  const plazoDiscounts: Record<number, number> = {
    24: 0,
    30: 300,
    36: 700,
  };

  const equipmentRows: (string | number)[][] = rawDevices.map((dev) => {
    const row: (string | number)[] = [dev.brand, dev.model, dev.storage];

    planNames.forEach((plan) => {
      const planDisc = planDiscounts[plan] || 0;

      [24, 30, 36].forEach((plazo) => {
        // If user specified exact price for iPhone 18 Pro Max on Black 36m:
        if (dev.black36mSpecial && plan === 'Black' && plazo === 36) {
          row.push(dev.black36mSpecial);
        } else {
          const plazoDisc = plazoDiscounts[plazo] || 0;
          const promoPrice = Math.max(1000, dev.basePrice - planDisc - plazoDisc);
          row.push(promoPrice);
        }
      });
    });

    return row;
  });

  const fullSheetRows = [row1, row2, row3, ...equipmentRows];

  const wsPremium = XLSX.utils.aoa_to_sheet(fullSheetRows);
  XLSX.utils.book_append_sheet(wb, wsPremium, 'Promociones AT&T Premium');

  // 3. Unused sheet: "Planes Comerciales" (will be discarded to save space)
  const planesData = [
    ['Nombre Plan', 'Renta Mensual'],
    ['Azul 1', 299],
    ['Azul 2', 399],
    ['Black', 999],
  ];
  const wsPlanes = XLSX.utils.aoa_to_sheet(planesData);
  XLSX.utils.book_append_sheet(wb, wsPlanes, 'Planes Comerciales');

  // 4. Unused sheet: "Accesorios" (will be discarded to save space)
  const accesoriosData = [
    ['Accesorio', 'Precio'],
    ['AirPods Pro', 4999],
  ];
  const wsAccesorios = XLSX.utils.aoa_to_sheet(accesoriosData);
  XLSX.utils.book_append_sheet(wb, wsAccesorios, 'Accesorios');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const filename = 'LISTA DE PRECIOS AT&T - PROMOCIONES PREMIUM.xlsx';

  return {
    buffer: excelBuffer,
    filename,
  };
};

export const downloadSampleATTExcel = () => {
  const { buffer, filename } = createSampleATTExcelBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

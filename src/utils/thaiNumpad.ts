import Swal from 'sweetalert2';

interface NumpadOptions {
  title: string;
  defaultValue?: string | number;
  allowDecimal?: boolean;
}

export function promptNumpad({ title, defaultValue = '0', allowDecimal = true }: NumpadOptions): Promise<number | null> {
  return new Promise((resolve) => {
    let currentVal = String(defaultValue);
    
    // Normalize initial value
    if (currentVal === 'undefined' || currentVal === 'null' || !currentVal.trim()) {
      currentVal = '0';
    }

    const updateDisplay = () => {
      const displayElem = document.getElementById('numpad-display-screen');
      if (displayElem) {
        displayElem.innerText = currentVal;
      }
    };

    Swal.fire({
      title: `<span class="text-lg font-bold text-slate-800">${title}</span>`,
      html: `
        <div class="flex flex-col items-center select-none">
          <!-- Screen Display -->
          <div id="numpad-display-screen" class="w-full text-right bg-slate-100 text-slate-800 text-3xl font-mono p-4.5 rounded-2xl mb-4 font-bold tracking-wider outline-none min-h-[72px] shadow-inner border border-slate-200">
            ${currentVal}
          </div>
          
          <!-- Keypad Grid -->
          <div class="grid grid-cols-3 gap-2.5 w-full max-w-[320px]">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
              <button type="button" class="numpad-key p-4 bg-slate-50 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold font-mono rounded-xl text-xl cursor-pointer transition-all border border-slate-100 shadow-2xs" data-val="${num}">${num}</button>
            `).join('')}
            
            <button type="button" id="numpad-key-clear" class="numpad-key p-4 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold rounded-xl text-base cursor-pointer transition-all border border-rose-100" data-val="clear">ล้าง</button>
            <button type="button" class="numpad-key p-4 bg-slate-50 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold font-mono rounded-xl text-xl cursor-pointer transition-all border border-slate-100 shadow-2xs" data-val="0">0</button>
            
            ${allowDecimal ? `
              <button type="button" class="numpad-key p-4 bg-slate-50 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold font-mono rounded-xl text-xl cursor-pointer transition-all border border-slate-100 shadow-2xs" data-val=".">.</button>
            ` : `
              <button type="button" class="numpad-key p-4 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 font-bold rounded-xl text-base cursor-pointer transition-all border border-amber-100" data-val="backspace">ลบ</button>
            `}
            
            ${allowDecimal ? `
              <button type="button" class="numpad-key col-span-3 p-3.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 font-bold rounded-xl text-sm cursor-pointer transition-all border border-amber-100 mt-1" data-val="backspace">ลบข้อความทีละตัว</button>
            ` : ''}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#b55fe6', // Soft elegant POS Purple
      cancelButtonColor: '#94a3b8',
      didOpen: () => {
        const container = Swal.getHtmlContainer();
        if (container) {
          const keys = container.querySelectorAll('.numpad-key');
          keys.forEach(key => {
            key.addEventListener('click', (e) => {
              const val = (e.currentTarget as HTMLButtonElement).getAttribute('data-val');
              if (val === 'clear') {
                currentVal = '0';
              } else if (val === 'backspace') {
                currentVal = currentVal.slice(0, -1);
                if (currentVal === '' || currentVal === '-') currentVal = '0';
              } else if (val === '.') {
                if (!currentVal.includes('.')) {
                  currentVal += '.';
                }
              } else if (val) {
                if (currentVal === '0') {
                  currentVal = val;
                } else {
                  currentVal += val;
                }
              }
              updateDisplay();
            });
          });
        }
      },
      preConfirm: () => {
        const parsed = parseFloat(currentVal);
        return isNaN(parsed) ? 0 : parsed;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        resolve(result.value);
      } else {
        resolve(null);
      }
    });
  });
}

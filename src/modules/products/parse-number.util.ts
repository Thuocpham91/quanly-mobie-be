export function parseNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    let str = String(value).trim();
    if (!str) {
        return 0;
    }

    str = str.replace(/[₫$VNĐvnd]/gi, '').trim();
    if ((str.match(/\./g) || []).length > 1) {
        str = str.replace(/\./g, '');
    }
    if ((str.match(/,/g) || []).length > 1) {
        str = str.replace(/,/g, '');
    }

    if (str.includes(',') && str.includes('.')) {
        const commaIndex = str.indexOf(',');
        const dotIndex = str.indexOf('.');
        if (commaIndex > dotIndex) {
            str = str.replace(/\./g, '').replace(/,/g, '.');
        } else {
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        const parts = str.split(',');
        if (parts.length === 2 && parts[1].length === 3) {
            str = str.replace(/,/g, '');
        } else {
            str = str.replace(/,/g, '.');
        }
    } else if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
            str = str.replace(/\./g, '');
        }
    }

    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : 0;
}


export function parseBoolean(value: unknown): boolean {

    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'x', 'dich vu', 'dịch vụ'].includes(normalized);



}
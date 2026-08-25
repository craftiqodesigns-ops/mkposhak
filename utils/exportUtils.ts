import jsPDF from 'jspdf';
import 'jspdf-autotable';

const formatDateForFilename = () => {
    return new Date().toISOString().slice(0, 10);
};

/**
 * Exports data to a CSV file.
 * @param headers - Array of header strings.
 * @param data - Array of objects where keys match headers.
 * @param filename - Base name for the file (without extension).
 */
export const exportToCsv = (headers: string[], data: Record<string, any>[], filename: string) => {
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                let cell = row[header];
                if (cell === null || cell === undefined) {
                    cell = '';
                }
                const cellString = String(cell);
                // Handle values that might contain commas by enclosing them in double quotes.
                if (cellString.includes(',')) {
                    return `"${cellString.replace(/"/g, '""')}"`; // Escape double quotes within the string
                }
                return cellString;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${formatDateForFilename()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Exports data to a PDF file using jspdf-autotable.
 * @param title - The title of the document.
 * @param headers - Array of header strings for the table.
 * @param data - 2D array of data for the table body.
 * @param filename - Base name for the file (without extension).
 */
export const exportToPdf = (title: string, headers: string[], data: any[][], filename:string) => {
    const doc = new jsPDF();
    
    doc.text(title, 14, 15);
    
    (doc as any).autoTable({
        startY: 20,
        head: [headers],
        body: data,
        theme: 'striped',
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [41, 128, 185], // A shade of blue
            textColor: 255,
            fontStyle: 'bold',
        }
    });

    doc.save(`${filename}_${formatDateForFilename()}.pdf`);
};

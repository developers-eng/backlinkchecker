"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Table as TableIcon, Plus, Trash2 } from "lucide-react";
import { BacklinkJob } from "@/app/page";

interface BacklinkInputProps {
  onJobStart: (jobId: string, jobs: BacklinkJob[]) => void;
}

interface TableRow {
  id: string;
  urlFrom: string;
  urlTo: string;
  anchorText: string;
}

export function BacklinkInput({ onJobStart }: BacklinkInputProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [tableData, setTableData] = useState<TableRow[]>([
    { id: "1", urlFrom: "", urlTo: "", anchorText: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
    }
  };

  const addTableRow = () => {
    const newRow: TableRow = {
      id: Date.now().toString(),
      urlFrom: "",
      urlTo: "",
      anchorText: ""
    };
    setTableData([...tableData, newRow]);
  };

  const removeTableRow = (id: string) => {
    if (tableData.length > 1) {
      setTableData(tableData.filter(row => row.id !== id));
    }
  };

  const updateTableRow = (id: string, field: keyof Omit<TableRow, 'id'>, value: string) => {
    setTableData(tableData.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleCellPaste = async (e: React.ClipboardEvent, rowId: string, field: keyof Omit<TableRow, 'id'>) => {
    e.preventDefault();
    
    try {
      const text = e.clipboardData.getData('text');
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 1) {
        // Single cell paste
        const values = lines[0].split('\t');
        if (values.length === 1) {
          // Single value
          updateTableRow(rowId, field, values[0].trim());
        } else {
          // Multiple columns in one row
          const rowIndex = tableData.findIndex(row => row.id === rowId);
          const fields: (keyof Omit<TableRow, 'id'>)[] = ['urlFrom', 'urlTo', 'anchorText'];
          const startFieldIndex = fields.indexOf(field);
          
          values.forEach((value, index) => {
            const fieldIndex = startFieldIndex + index;
            if (fieldIndex < fields.length) {
              updateTableRow(rowId, fields[fieldIndex], value.trim());
            }
          });
        }
      } else {
        // Multi-row paste
        const rowIndex = tableData.findIndex(row => row.id === rowId);
        const newTableData = [...tableData];
        
        lines.forEach((line, lineIndex) => {
          const values = line.split('\t');
          const targetRowIndex = rowIndex + lineIndex;
          
          // Add new rows if needed
          while (newTableData.length <= targetRowIndex) {
            newTableData.push({
              id: `paste_${Date.now()}_${newTableData.length}`,
              urlFrom: "",
              urlTo: "",
              anchorText: ""
            });
          }
          
          const fields: (keyof Omit<TableRow, 'id'>)[] = ['urlFrom', 'urlTo', 'anchorText'];
          const startFieldIndex = fields.indexOf(field);
          
          values.forEach((value, colIndex) => {
            const fieldIndex = startFieldIndex + colIndex;
            if (fieldIndex < fields.length && targetRowIndex < newTableData.length) {
              newTableData[targetRowIndex][fields[fieldIndex]] = value.trim();
            }
          });
        });
        
        setTableData(newTableData);
      }
    } catch (error) {
      console.error('Failed to paste data:', error);
    }
  };

  const pasteEntireSheet = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      const newTableData: TableRow[] = [];
      
      lines.forEach((line, index) => {
        const values = line.split('\t').map(item => item.trim().replace(/"/g, ''));
        const [urlFrom, urlTo, anchorText] = values;
        
        newTableData.push({
          id: `paste_${index}`,
          urlFrom: urlFrom || "",
          urlTo: urlTo || "",
          anchorText: anchorText || ""
        });
      });
      
      setTableData(newTableData.length > 0 ? newTableData : [{ id: "1", urlFrom: "", urlTo: "", anchorText: "" }]);
    } catch (error) {
      console.error('Failed to paste data:', error);
    }
  };

  const handleSubmit = async (type: 'csv' | 'manual' | 'table') => {
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      
      if (type === 'csv' && csvFile) {
        formData.append('file', csvFile);
        formData.append('type', 'csv');
      } else if (type === 'manual' && manualInput.trim()) {
        formData.append('data', manualInput);
        formData.append('type', 'manual');
      } else if (type === 'table') {
        const validRows = tableData.filter(row => row.urlFrom && row.urlTo);
        if (validRows.length === 0) return;
        
        const csvData = validRows.map(row => 
          `${row.urlFrom},${row.urlTo},${row.anchorText}`
        ).join('\n');
        
        formData.append('data', csvData);
        formData.append('type', 'manual');
      } else {
        return;
      }

      const response = await fetch('/api/check', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start job');
      }

      const result = await response.json();
      onJobStart(result.jobId, result.jobs);
      
      // Reset form
      setCsvFile(null);
      setManualInput("");
      if (type === 'table') {
        setTableData([{ id: "1", urlFrom: "", urlTo: "", anchorText: "" }]);
      }
      
    } catch (error) {
      console.error('Error starting job:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Tabs defaultValue="table" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="table">
          <TableIcon className="w-4 h-4 mr-2" />
          Table Input
        </TabsTrigger>
        <TabsTrigger value="csv">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV
        </TabsTrigger>
        <TabsTrigger value="manual">
          <FileText className="w-4 h-4 mr-2" />
          Manual Input
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="table" className="space-y-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Backlink Data</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pasteEntireSheet}
              >
                Paste Sheet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTableRow}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Row
              </Button>
            </div>
          </div>
          
          <div className="border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold border-r text-center py-2">URL From</TableHead>
                  <TableHead className="font-semibold border-r text-center py-2">URL To</TableHead>
                  <TableHead className="font-semibold border-r text-center py-2">Anchor Text</TableHead>
                  <TableHead className="w-12 font-semibold text-center py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.id} className="border-b">
                    <TableCell className="p-0 border-r">
                      <Input
                        placeholder="https://source.com/page"
                        value={row.urlFrom}
                        onChange={(e) => updateTableRow(row.id, 'urlFrom', e.target.value)}
                        onPaste={(e) => handleCellPaste(e, row.id, 'urlFrom')}
                        disabled={isSubmitting}
                        className="border-0 rounded-none focus:ring-1 focus:ring-blue-500 focus:ring-inset font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-0 border-r">
                      <Input
                        placeholder="https://target.com"
                        value={row.urlTo}
                        onChange={(e) => updateTableRow(row.id, 'urlTo', e.target.value)}
                        onPaste={(e) => handleCellPaste(e, row.id, 'urlTo')}
                        disabled={isSubmitting}
                        className="border-0 rounded-none focus:ring-1 focus:ring-blue-500 focus:ring-inset font-mono text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-0 border-r">
                      <Input
                        placeholder="Anchor text"
                        value={row.anchorText}
                        onChange={(e) => updateTableRow(row.id, 'anchorText', e.target.value)}
                        onPaste={(e) => handleCellPaste(e, row.id, 'anchorText')}
                        disabled={isSubmitting}
                        className="border-0 rounded-none focus:ring-1 focus:ring-blue-500 focus:ring-inset text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTableRow(row.id)}
                        disabled={tableData.length <= 1 || isSubmitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Spreadsheet-like functionality:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Paste entire data from Excel/Google Sheets using "Paste Sheet" button</li>
              <li>Paste into individual cells - automatically expands across columns and rows</li>
              <li>Tab-separated values are automatically parsed into separate columns</li>
              <li>Copy multiple rows from spreadsheets and paste into any cell to fill the table</li>
            </ul>
          </div>
        </div>
        
        <Button 
          onClick={() => handleSubmit('table')} 
          disabled={!tableData.some(row => row.urlFrom && row.urlTo) || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Starting Check..." : "Start Backlink Check"}
        </Button>
      </TabsContent>
      
      <TabsContent value="csv" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv-file">CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isSubmitting}
          />
          <p className="text-sm text-muted-foreground">
            Format: url_from,url_to,anchor_text
          </p>
        </div>
        <Button 
          onClick={() => handleSubmit('csv')} 
          disabled={!csvFile || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Starting Check..." : "Start Backlink Check"}
        </Button>
      </TabsContent>
      
      <TabsContent value="manual" className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="manual-data">Backlink Data</Label>
          <Textarea
            id="manual-data"
            placeholder="url_from,url_to,anchor_text&#10;https://example.com/page,https://you.com,SEO Tools&#10;https://blog.com/post,https://you.com,Click Here"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            rows={6}
            disabled={isSubmitting}
          />
          <p className="text-sm text-muted-foreground">
            Enter one backlink per line in CSV format
          </p>
        </div>
        <Button 
          onClick={() => handleSubmit('manual')} 
          disabled={!manualInput.trim() || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Starting Check..." : "Start Backlink Check"}
        </Button>
      </TabsContent>
    </Tabs>
  );
}

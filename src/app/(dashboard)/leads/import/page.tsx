"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { checkPlanLimit } from "@/lib/plan-limit";
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import {
  sanitizeCsvValue,
  isBinaryContent,
} from "@/lib/csv-sanitize";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface ParsedLead {
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [detectedFields, setDetectedFields] = useState<{ name: string; email: string; phone: string }>({ name: "", email: "", phone: "" });
  const [step, setStep] = useState<"upload" | "map" | "review" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function processFile(file: File): void {
    setErrors([]);
    setFile(file);

    if (file.size > MAX_FILE_SIZE) {
      setErrors([`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      if (isBinaryContent(text)) {
        setErrors(["File appears to be binary, not a CSV. Please upload a valid CSV file."]);
        return;
      }

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setErrors([`CSV parsing error: ${results.errors[0].message}`]);
            return;
          }

          const data = results.data as Record<string, string>[];
          if (data.length === 0) {
            setErrors(["CSV file is empty or has no data rows"]);
            return;
          }

          const originalHeaders = Object.keys(data[0]);
          const headers = originalHeaders.map((h) => h.trim().toLowerCase());

          const nameIdx = headers.findIndex((h) =>
            ["name", "full_name", "fullname", "contact", "lead", "first name", "first_name", "firstname"].includes(h)
          );
          const lastNameIdx = headers.findIndex((h) =>
            ["last name", "last_name", "lastname", "surname"].includes(h)
          );
          const emailIdx = headers.findIndex((h) =>
            ["email", "email_address", "emailaddress", "e-mail"].includes(h)
          );
          const phoneIdx = headers.findIndex((h) =>
            ["phone", "phone_number", "phonenumber", "mobile", "cell", "telephone", "tel"].includes(h)
          );

          const nameCol = nameIdx >= 0 ? originalHeaders[nameIdx] : null;
          const lastNameCol = lastNameIdx >= 0 ? originalHeaders[lastNameIdx] : null;
          const emailCol = emailIdx >= 0 ? originalHeaders[emailIdx] : null;
          const phoneCol = phoneIdx >= 0 ? originalHeaders[phoneIdx] : null;
          const firstNameCol = headers.find((h) =>
            ["first name", "first_name", "firstname"].includes(h)
          ) ? originalHeaders[headers.findIndex((h) =>
            ["first name", "first_name", "firstname"].includes(h)
          )] : null;

          const detectedName = nameCol || lastNameCol || originalHeaders[0] || "";
          const detectedEmail = emailCol || "";
          const detectedPhone = phoneCol || "";

          setColumnMapping({
            name: detectedName,
            email: detectedEmail,
            phone: detectedPhone,
          });

          setDetectedFields({
            name: detectedName,
            email: detectedEmail,
            phone: detectedPhone,
          });

          setParsedLeads(
            data.map((row) => {
              let fullName = "";
              if (nameCol) {
                fullName = row[nameCol] || "";
              } else if (lastNameCol) {
                fullName = firstNameCol
                  ? `${row[firstNameCol] || ""} ${row[lastNameCol] || ""}`.trim()
                  : row[lastNameCol] || "";
              }
              return {
                full_name: sanitizeCsvValue(fullName),
                email: emailCol ? sanitizeCsvValue(row[emailCol] || "") || null : null,
                phone: phoneCol ? sanitizeCsvValue(row[phoneCol] || "") || null : null,
                source: "csv_import",
              };
            })
          );

          const hasConfidentDetection = nameCol || (lastNameCol && firstNameCol);

          setStep(hasConfidentDetection ? "review" : "map");
        },
      });
    };
    reader.readAsText(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    setLoading(true);
    setErrors([]);

    // Client-side plan limit check (UX — server also enforces)
    const limit = await checkPlanLimit();
    if (limit.error) {
      setErrors([limit.error]);
      setLoading(false);
      return;
    }

    if (!limit.allowed) {
      showToast(
        `Plan limit reached. You have ${limit.currentCount} active leads (${limit.plan} plan). Upgrade to Pro for unlimited.`,
        "error",
        { label: "Upgrade to Pro", href: "/settings/billing" }
      );
      setLoading(false);
      return;
    }

    const remaining = limit.maxAllowed - limit.currentCount;
    if (isFinite(remaining) && parsedLeads.length > remaining) {
      showToast(
        `You can only import ${remaining} more leads on the Free plan. ${parsedLeads.length - remaining} leads will be skipped.`,
        "info",
        { label: "Upgrade to Pro", href: "/settings/billing" }
      );
    }

    // Filter out rows with empty names client-side (server validates too)
    const validLeads = parsedLeads.filter((lead) => lead.full_name.trim());

    // POST to server-side import endpoint for proper validation + plan enforcement
    const formData = new FormData();
    formData.append("leads", JSON.stringify(validLeads));

    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors([result.error || "Import failed"]);
        setLoading(false);
        return;
      }

      setImported(result.imported ?? 0);
      setErrors(result.errors ?? []);
      setStep("done");
    } catch {
      setErrors(["Network error — please check your connection and try again."]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
        <h1 className="font-heading text-2xl font-bold text-surface-900">Import Contacts</h1>
        <p className="text-surface-500 text-sm mt-1">
          Upload a CSV file from your phone or old CRM
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["upload", "map", "review", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-primary text-white"
                  : ["upload", "map", "review", "done"].indexOf(step) > i
                  ? "bg-primary-100 text-primary"
                  : "bg-surface-100 text-surface-500"
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && <div className="w-8 h-0.5 bg-surface-200" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === "upload" && (
        <Card>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file"
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary-50"
                : "border-surface-200 hover:border-primary hover:bg-primary-50"
            }`}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-700 font-medium mb-1">
              Click to upload CSV
            </p>
            <p className="text-sm text-surface-500">
              Or drag and drop your file here
            </p>
            <p className="text-xs text-surface-500 mt-2">
              Max {MAX_FILE_SIZE / 1024 / 1024}MB
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          {errors.length > 0 && (
            <div className="p-3 mx-4 mb-4 rounded-lg bg-destructive-50 text-destructive text-sm">
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Map Step */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Map Columns
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-surface-500 mb-4">
            Match your CSV columns to lead fields. Found {parsedLeads.length} rows.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Name column <span className="text-destructive">*</span>
              </label>
              <select
                value={columnMapping.name}
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, name: e.target.value })
                }
                className="input-field"
              >
                <option value="">Select column</option>
                {Object.keys(parsedLeads[0] || {}).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Email column
              </label>
              <select
                value={columnMapping.email}
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, email: e.target.value })
                }
                className="input-field"
              >
                <option value="">None</option>
                {Object.keys(parsedLeads[0] || {}).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Phone column
              </label>
              <select
                value={columnMapping.phone}
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, phone: e.target.value })
                }
                className="input-field"
              >
                <option value="">None</option>
                {Object.keys(parsedLeads[0] || {}).map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-surface-700 mb-2">Preview (first 3 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-2 text-surface-500">Name</th>
                    <th className="text-left py-2 text-surface-500">Email</th>
                    <th className="text-left py-2 text-surface-500">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedLeads.slice(0, 3).map((lead, i) => (
                    <tr key={i} className="border-b border-surface-100">
                      <td className="py-2">{lead.full_name}</td>
                      <td className="py-2 text-surface-500">{lead.email || "-"}</td>
                      <td className="py-2 text-surface-500">{lead.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setStep("upload")} className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={!columnMapping.name}
              loading={loading}
              className="flex-1"
            >
              Import {parsedLeads.length} leads
            </Button>
          </div>
        </Card>
      )}

      {/* Review Step — auto-detected columns, skip mapping */}
      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ready to Import
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-surface-500 mb-4">
            Found {parsedLeads.length} leads. Columns auto-detected:
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-surface-700 w-16">Name:</span>
              <span className="text-primary">{detectedFields.name}</span>
            </div>
            {detectedFields.email && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-surface-700 w-16">Email:</span>
                <span className="text-primary">{detectedFields.email}</span>
              </div>
            )}
            {detectedFields.phone && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-surface-700 w-16">Phone:</span>
                <span className="text-primary">{detectedFields.phone}</span>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-surface-700 mb-2">Preview (first 3 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-2 text-surface-500">Name</th>
                    {detectedFields.email && <th className="text-left py-2 text-surface-500">Email</th>}
                    {detectedFields.phone && <th className="text-left py-2 text-surface-500">Phone</th>}
                  </tr>
                </thead>
                <tbody>
                  {parsedLeads.slice(0, 3).map((lead, i) => (
                    <tr key={i} className="border-b border-surface-100">
                      <td className="py-2">{lead.full_name}</td>
                      {detectedFields.email && <td className="py-2 text-surface-500">{lead.email || "-"}</td>}
                      {detectedFields.phone && <td className="py-2 text-surface-500">{lead.phone || "-"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setStep("map")} className="flex-1">
              Change mapping
            </Button>
            <Button
              onClick={handleImport}
              disabled={!columnMapping.name}
              loading={loading}
              className="flex-1"
            >
              Import {parsedLeads.length} leads
            </Button>
          </div>
        </Card>
      )}

      {/* Done Step */}
      {step === "done" && (
        <Card>
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="font-heading text-xl font-semibold text-surface-900 mb-1">
              Import Complete
            </h2>
            <p className="text-surface-500 mb-4">
              {imported} leads imported successfully
            </p>
            {errors.length > 0 && (
              <div className="text-left bg-destructive-50 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-destructive mb-1">
                  {errors.length} errors:
                </p>
                {errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-destructive-700">
                    {err}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={() => router.push("/leads")} className="w-full">
              View all leads
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

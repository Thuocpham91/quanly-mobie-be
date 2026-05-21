import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";

@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name);
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
    Handlebars.registerHelper("abs", (n: number) => Math.abs(n));
    Handlebars.registerHelper("formatDate", (date: string | Date) => {
      const d = new Date(date);
      return d.toLocaleString("vi-VN");
    });
  }

  private loadTemplate(templatePath: string): Handlebars.TemplateDelegate {
    if (this.cache.has(templatePath)) return this.cache.get(templatePath)!;

    if (!fs.existsSync(templatePath)) {
      this.logger.warn(`Template not found: ${templatePath}`);
      return Handlebars.compile("{{message}}");
    }

    const content = fs.readFileSync(templatePath, "utf8");
    const compiled = Handlebars.compile(content);
    this.cache.set(templatePath, compiled);
    return compiled;
  }

  render(templateDir: string, fileName: string, context: any): string {
    const filePath = path.join(templateDir, fileName);
    const template = this.loadTemplate(filePath);
    return template(context);
  }
}

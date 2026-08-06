import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GenerateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsOptional()
  email?: string;
}

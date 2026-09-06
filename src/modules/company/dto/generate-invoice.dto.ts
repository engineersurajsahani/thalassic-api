import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class GenerateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  amount: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  email?: string;
}

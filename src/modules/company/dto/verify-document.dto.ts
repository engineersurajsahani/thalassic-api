import { IsNotEmpty, IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class VerifyDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['Verified', 'Rejected', 'Re-upload'])
  status: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  remarks?: string;
}

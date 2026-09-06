import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSeafarerDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  status?: string; // e.g., 'Active', 'Deactivated'
}

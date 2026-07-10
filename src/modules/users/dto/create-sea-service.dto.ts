import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSeaServiceDto {
  @IsString()
  @IsNotEmpty()
  vesselName: string;

  @IsString()
  @IsNotEmpty()
  imoNumber: string;

  @IsString()
  @IsNotEmpty()
  rank: string;

  @IsString()
  @IsNotEmpty()
  signOn: string;

  @IsString()
  @IsNotEmpty()
  signOff: string;

  @IsString()
  @IsNotEmpty()
  company: string;
}

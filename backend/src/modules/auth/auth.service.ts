import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}

	async register(dto: RegisterDto) {
		const existingUser = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (existingUser) {
			throw new BadRequestException('Email is already registered');
		}

		const hashedPassword = await bcrypt.hash(dto.password, 12);

		const user = await this.prisma.user.create({
			data: {
				email: dto.email,
				password: hashedPassword,
			},
			select: {
				id: true,
				email: true,
				createdAt: true,
			},
		});

		const accessToken = await this.jwtService.signAsync({
			sub: user.id,
			email: user.email,
		});

		return { user, accessToken };
	}

	async login(dto: LoginDto) {
		const user = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (!user) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const passwordMatches = await bcrypt.compare(dto.password, user.password);

		if (!passwordMatches) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const accessToken = await this.jwtService.signAsync({
			sub: user.id,
			email: user.email,
		});

		return {
			user: {
				id: user.id,
				email: user.email,
				createdAt: user.createdAt,
			},
			accessToken,
		};
	}
}

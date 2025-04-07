import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ token: string; user: Partial<User> }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create new user
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    // Generate JWT
    const token = this.generateToken(user);

    // Return user (without password) and token
    const { password, ...result } = user;
    return { token, user: result };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ token: string; user: Partial<User> }> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT
    const token = this.generateToken(user);

    // Return user (without password) and token
    const { password, ...result } = user;
    return { token, user: result };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }
}

package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.example.data.model.ColorAccent

private fun createDarkColorScheme(accent: ColorAccent) = darkColorScheme(
    primary = if (accent == ColorAccent.ELECTRIC_GREEN) NeonGreen else ElectricBlue,
    onPrimary = Color(0xFF00381B),
    primaryContainer = if (accent == ColorAccent.ELECTRIC_GREEN) NeonGreenContainer else ElectricBlueContainer,
    onPrimaryContainer = if (accent == ColorAccent.ELECTRIC_GREEN) Color(0xFF8FFFC2) else Color(0xFFB8D8FF),
    secondary = if (accent == ColorAccent.ELECTRIC_GREEN) ElectricCyan else NeonGreen,
    onSecondary = Color(0xFF00363A),
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkCardBorder,
    error = ErrorRed,
    onError = Color.White
)

private fun createLightColorScheme(accent: ColorAccent) = lightColorScheme(
    primary = if (accent == ColorAccent.ELECTRIC_GREEN) NeonGreenVariant else ElectricBlueVariant,
    onPrimary = Color.White,
    primaryContainer = if (accent == ColorAccent.ELECTRIC_GREEN) Color(0xFFE8F5E9) else Color(0xFFE3F2FD),
    onPrimaryContainer = if (accent == ColorAccent.ELECTRIC_GREEN) Color(0xFF1B5E20) else Color(0xFF0D47A1),
    secondary = if (accent == ColorAccent.ELECTRIC_GREEN) ElectricBlue else NeonGreenVariant,
    onSecondary = Color.White,
    background = LightBackground,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightTextSecondary,
    outline = LightCardBorder,
    error = ErrorRed,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = true,
    accent: ColorAccent = ColorAccent.ELECTRIC_GREEN,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) {
        createDarkColorScheme(accent)
    } else {
        createLightColorScheme(accent)
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

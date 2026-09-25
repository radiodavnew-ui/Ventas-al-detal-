package com.example.data.model

enum class AppLanguage(val code: String, val label: String) {
    SPANISH("es", "Español"),
    ENGLISH("en", "English")
}

enum class ColorAccent(val id: String, val labelEs: String, val labelEn: String) {
    ELECTRIC_GREEN("green", "Verde Neón", "Electric Green"),
    ELECTRIC_BLUE("blue", "Azul Eléctrico", "Electric Blue")
}

data class StoreSettings(
    val storeName: String = "Mi Tienda al Detal",
    val logoUri: String = "",
    val exchangeRateUsdToBs: Double = 54.20,
    val language: AppLanguage = AppLanguage.SPANISH,
    val colorAccent: ColorAccent = ColorAccent.ELECTRIC_GREEN,
    val isDarkMode: Boolean = true
)

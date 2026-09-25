package com.example.util

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.widget.Toast
import androidx.core.content.FileProvider
import com.example.data.model.AppLanguage
import com.example.data.model.PaymentMethod
import com.example.data.model.Sale
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

object ImageUtils {

    /**
     * Copies any Uri (e.g. from photo picker) into app's private files directory
     * so it never gets deleted or lost across app restarts.
     */
    fun saveImageToInternalStorage(context: Context, sourceUri: Uri, prefix: String): String? {
        return try {
            val imagesDir = File(context.filesDir, "images")
            if (!imagesDir.exists()) imagesDir.mkdirs()

            val fileName = "${prefix}_${System.currentTimeMillis()}.jpg"
            val destFile = File(imagesDir, fileName)

            context.contentResolver.openInputStream(sourceUri)?.use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }
            destFile.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Generates a high-quality Bitmap receipt image and shares it via Intent as an image (PNG).
     */
    fun shareSaleReceiptAsImage(
        context: Context,
        sale: Sale,
        storeName: String,
        logoPath: String?,
        language: AppLanguage
    ) {
        try {
            val bitmap = createReceiptBitmap(context, sale, storeName, logoPath, language)
            shareBitmap(context, bitmap, "recibo_venta_${sale.receiptNumber}.png", "Compartir Recibo de Venta")
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Error al generar imagen de recibo: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Generates a high-quality Bitmap report of daily/weekly sales and shares it via Intent.
     */
    fun shareSalesReportAsImage(
        context: Context,
        title: String,
        storeName: String,
        totalUsd: Double,
        totalBs: Double,
        cashUsd: Double,
        cashBs: Double,
        pagoMovilUsd: Double,
        pagoMovilBs: Double,
        puntoVentaUsd: Double,
        puntoVentaBs: Double,
        salesCount: Int,
        weeklyAverageUsd: Double?,
        weeklyAverageBs: Double?,
        language: AppLanguage
    ) {
        try {
            val bitmap = createReportBitmap(
                context = context,
                title = title,
                storeName = storeName,
                totalUsd = totalUsd,
                totalBs = totalBs,
                cashUsd = cashUsd,
                cashBs = cashBs,
                pagoMovilUsd = pagoMovilUsd,
                pagoMovilBs = pagoMovilBs,
                puntoVentaUsd = puntoVentaUsd,
                puntoVentaBs = puntoVentaBs,
                salesCount = salesCount,
                weeklyAverageUsd = weeklyAverageUsd,
                weeklyAverageBs = weeklyAverageBs,
                language = language
            )
            shareBitmap(context, bitmap, "reporte_ventas_${System.currentTimeMillis()}.png", "Compartir Reporte de Ventas")
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Error al generar imagen del reporte: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareBitmap(context: Context, bitmap: Bitmap, fileName: String, chooserTitle: String) {
        val cacheImagesDir = File(context.cacheDir, "images")
        if (!cacheImagesDir.exists()) cacheImagesDir.mkdirs()

        val imageFile = File(cacheImagesDir, fileName)
        val fos = FileOutputStream(imageFile)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
        fos.flush()
        fos.close()

        val contentUri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            imageFile
        )

        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, contentUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val chooser = Intent.createChooser(shareIntent, chooserTitle).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    private fun createReceiptBitmap(
        context: Context,
        sale: Sale,
        storeName: String,
        logoPath: String?,
        language: AppLanguage
    ): Bitmap {
        val isEs = language == AppLanguage.SPANISH
        val width = 720
        // Dynamic height based on number of items
        val baseHeight = 900
        val itemsExtraHeight = sale.items.size * 60
        val height = baseHeight + itemsExtraHeight

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Background: Clean Dark Modern Card
        val bgPaint = Paint().apply {
            color = Color.rgb(24, 27, 32)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // Top Accent Stripe (Neon Green)
        val stripePaint = Paint().apply {
            color = Color.rgb(0, 230, 118)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), 12f, stripePaint)

        var currentY = 50f
        val textPaint = Paint().apply {
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }

        // Draw Logo if available
        if (!logoPath.isNullOrBlank()) {
            try {
                val logoFile = File(logoPath)
                if (logoFile.exists()) {
                    val logoBm = BitmapFactory.decodeFile(logoFile.absolutePath)
                    if (logoBm != null) {
                        val scaledLogo = Bitmap.createScaledBitmap(logoBm, 120, 120, true)
                        canvas.drawBitmap(scaledLogo, (width - 120) / 2f, currentY, null)
                        currentY += 140f
                    }
                }
            } catch (_: Exception) {}
        }

        // Store Name
        textPaint.color = Color.WHITE
        textPaint.textSize = 34f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        canvas.drawText(storeName, width / 2f, currentY, textPaint)
        currentY += 40f

        // Subtitle: Receipt Ticket
        textPaint.color = Color.rgb(180, 190, 200)
        textPaint.textSize = 22f
        textPaint.typeface = Typeface.DEFAULT
        val receiptLabel = if (isEs) "TICKET DE VENTA #${sale.receiptNumber}" else "SALE RECEIPT #${sale.receiptNumber}"
        canvas.drawText(receiptLabel, width / 2f, currentY, textPaint)
        currentY += 32f

        // Date
        val dateText = CurrencyUtils.formatDate(sale.timestamp)
        canvas.drawText(dateText, width / 2f, currentY, textPaint)
        currentY += 35f

        // Divider
        val dividerPaint = Paint().apply {
            color = Color.rgb(60, 68, 80)
            strokeWidth = 2f
        }
        canvas.drawLine(40f, currentY, (width - 40).toFloat(), currentY, dividerPaint)
        currentY += 35f

        // Items Header
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.rgb(0, 230, 118)
        textPaint.textSize = 20f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)

        val prodHeader = if (isEs) "PRODUCTO / CANT." else "ITEM / QTY"
        val totalHeader = if (isEs) "TOTAL" else "TOTAL"
        canvas.drawText(prodHeader, 50f, currentY, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        canvas.drawText(totalHeader, (width - 50).toFloat(), currentY, textPaint)
        currentY += 30f

        // Item rows
        textPaint.typeface = Typeface.DEFAULT
        textPaint.textSize = 22f
        for (item in sale.items) {
            textPaint.textAlign = Paint.Align.LEFT
            textPaint.color = Color.WHITE
            val lineText = "${item.quantity}x ${item.productName}"
            canvas.drawText(lineText, 50f, currentY, textPaint)

            textPaint.textAlign = Paint.Align.RIGHT
            textPaint.color = Color.rgb(220, 230, 240)
            val priceLine = CurrencyUtils.formatUsd(item.totalUsd)
            canvas.drawText(priceLine, (width - 50).toFloat(), currentY, textPaint)
            currentY += 35f

            // Bolívares sub-row
            textPaint.color = Color.rgb(150, 160, 175)
            textPaint.textSize = 18f
            val itemBs = CurrencyUtils.formatBs(item.totalUsd * sale.exchangeRate)
            canvas.drawText("(${itemBs})", (width - 50).toFloat(), currentY, textPaint)
            currentY += 35f
            textPaint.textSize = 22f
        }

        currentY += 10f
        canvas.drawLine(40f, currentY, (width - 40).toFloat(), currentY, dividerPaint)
        currentY += 40f

        // Payment Method Box
        val methodBox = RectF(50f, currentY - 25f, (width - 50).toFloat(), currentY + 35f)
        val boxPaint = Paint().apply {
            color = Color.rgb(35, 42, 52)
            style = Paint.Style.FILL
        }
        canvas.drawRoundRect(methodBox, 16f, 16f, boxPaint)

        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.rgb(180, 195, 210)
        textPaint.textSize = 20f
        val paymentLabel = if (isEs) "Método de Pago:" else "Payment Method:"
        canvas.drawText(paymentLabel, 70f, currentY + 12f, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        textPaint.color = Color.rgb(0, 230, 118)
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        canvas.drawText(sale.paymentMethod.getDisplayName(isEs), (width - 70).toFloat(), currentY + 12f, textPaint)
        currentY += 75f

        // Rate
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.rgb(160, 170, 185)
        textPaint.textSize = 19f
        textPaint.typeface = Typeface.DEFAULT
        val rateText = if (isEs) "Tasa de Cambio: 1 USD = ${sale.exchangeRate} Bs." else "Exchange Rate: 1 USD = ${sale.exchangeRate} Bs."
        canvas.drawText(rateText, 50f, currentY, textPaint)
        currentY += 45f

        // Total USD
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.WHITE
        textPaint.textSize = 26f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        val totalUsdLabel = if (isEs) "TOTAL EN DÓLARES:" else "TOTAL IN USD:"
        canvas.drawText(totalUsdLabel, 50f, currentY, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        textPaint.color = Color.rgb(0, 230, 118)
        textPaint.textSize = 34f
        canvas.drawText(CurrencyUtils.formatUsd(sale.totalUsd), (width - 50).toFloat(), currentY, textPaint)
        currentY += 45f

        // Total Bs
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.WHITE
        textPaint.textSize = 24f
        val totalBsLabel = if (isEs) "TOTAL EN BOLÍVARES:" else "TOTAL IN BOLIVARES:"
        canvas.drawText(totalBsLabel, 50f, currentY, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        textPaint.color = Color.rgb(0, 200, 255)
        textPaint.textSize = 30f
        canvas.drawText(CurrencyUtils.formatBs(sale.totalBs), (width - 50).toFloat(), currentY, textPaint)
        currentY += 60f

        // Footer Note
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.rgb(130, 140, 155)
        textPaint.textSize = 18f
        textPaint.typeface = Typeface.DEFAULT
        val thanksText = if (isEs) "¡Gracias por su compra!" else "Thank you for your purchase!"
        canvas.drawText(thanksText, width / 2f, currentY, textPaint)

        return bitmap
    }

    private fun createReportBitmap(
        context: Context,
        title: String,
        storeName: String,
        totalUsd: Double,
        totalBs: Double,
        cashUsd: Double,
        cashBs: Double,
        pagoMovilUsd: Double,
        pagoMovilBs: Double,
        puntoVentaUsd: Double,
        puntoVentaBs: Double,
        salesCount: Int,
        weeklyAverageUsd: Double?,
        weeklyAverageBs: Double?,
        language: AppLanguage
    ): Bitmap {
        val isEs = language == AppLanguage.SPANISH
        val width = 760
        val height = 1100

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Background
        val bgPaint = Paint().apply {
            color = Color.rgb(20, 24, 30)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // Header banner
        val stripePaint = Paint().apply {
            color = Color.rgb(41, 121, 255)
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), 14f, stripePaint)

        val textPaint = Paint().apply {
            isAntiAlias = true
        }

        var currentY = 60f

        // Store Name
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.WHITE
        textPaint.textSize = 34f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        canvas.drawText(storeName, width / 2f, currentY, textPaint)
        currentY += 45f

        // Report Title
        textPaint.color = Color.rgb(0, 230, 118)
        textPaint.textSize = 28f
        canvas.drawText(title.uppercase(), width / 2f, currentY, textPaint)
        currentY += 35f

        // Date generated
        textPaint.color = Color.rgb(160, 175, 190)
        textPaint.textSize = 20f
        textPaint.typeface = Typeface.DEFAULT
        val dateGenerated = if (isEs) "Generado el: ${CurrencyUtils.formatDate(System.currentTimeMillis())}" else "Generated on: ${CurrencyUtils.formatDate(System.currentTimeMillis())}"
        canvas.drawText(dateGenerated, width / 2f, currentY, textPaint)
        currentY += 40f

        val dividerPaint = Paint().apply {
            color = Color.rgb(55, 65, 80)
            strokeWidth = 2f
        }
        canvas.drawLine(40f, currentY, (width - 40).toFloat(), currentY, dividerPaint)
        currentY += 40f

        // Big Total Sales Card
        val totalCard = RectF(40f, currentY, (width - 40).toFloat(), currentY + 140f)
        val cardPaint = Paint().apply {
            color = Color.rgb(30, 38, 48)
            style = Paint.Style.FILL
        }
        canvas.drawRoundRect(totalCard, 20f, 20f, cardPaint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.rgb(200, 215, 230)
        textPaint.textSize = 22f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        val grandTotalLabel = if (isEs) "TOTAL GENERAL DE VENTAS" else "GRAND TOTAL SALES"
        canvas.drawText(grandTotalLabel, width / 2f, currentY + 38f, textPaint)

        textPaint.color = Color.rgb(0, 230, 118)
        textPaint.textSize = 42f
        canvas.drawText(CurrencyUtils.formatUsd(totalUsd), width / 2f, currentY + 84f, textPaint)

        textPaint.color = Color.rgb(0, 200, 255)
        textPaint.textSize = 26f
        textPaint.typeface = Typeface.DEFAULT
        canvas.drawText(CurrencyUtils.formatBs(totalBs), width / 2f, currentY + 120f, textPaint)
        currentY += 175f

        // Section: Breakdown by payment method
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.WHITE
        textPaint.textSize = 24f
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        val breakdownTitle = if (isEs) "DESGLOSE POR MÉTODO DE PAGO:" else "BREAKDOWN BY PAYMENT METHOD:"
        canvas.drawText(breakdownTitle, 45f, currentY, textPaint)
        currentY += 35f

        // Draw Breakdown rows
        fun drawPaymentRow(label: String, usd: Double, bs: Double, colorDot: Int) {
            val rowBox = RectF(40f, currentY - 5f, (width - 40).toFloat(), currentY + 65f)
            val rowPaint = Paint().apply {
                color = Color.rgb(26, 32, 42)
                style = Paint.Style.FILL
            }
            canvas.drawRoundRect(rowBox, 14f, 14f, rowPaint)

            // Color indicator dot
            val dotPaint = Paint().apply {
                color = colorDot
                style = Paint.Style.FILL
            }
            canvas.drawCircle(65f, currentY + 30f, 10f, dotPaint)

            // Method label
            textPaint.textAlign = Paint.Align.LEFT
            textPaint.color = Color.WHITE
            textPaint.textSize = 22f
            textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            canvas.drawText(label, 90f, currentY + 38f, textPaint)

            // USD and Bs
            textPaint.textAlign = Paint.Align.RIGHT
            textPaint.color = Color.rgb(0, 230, 118)
            textPaint.textSize = 24f
            canvas.drawText(CurrencyUtils.formatUsd(usd), (width - 60).toFloat(), currentY + 28f, textPaint)

            textPaint.color = Color.rgb(160, 175, 195)
            textPaint.textSize = 19f
            textPaint.typeface = Typeface.DEFAULT
            canvas.drawText(CurrencyUtils.formatBs(bs), (width - 60).toFloat(), currentY + 54f, textPaint)

            currentY += 80f
        }

        val cashTitle = if (isEs) "Efectivo" else "Cash"
        val pmTitle = if (isEs) "Pago Móvil" else "Mobile Payment"
        val posTitle = if (isEs) "Punto de Venta" else "POS Terminal"

        drawPaymentRow(cashTitle, cashUsd, cashBs, Color.rgb(0, 230, 118))
        drawPaymentRow(pmTitle, pagoMovilUsd, pagoMovilBs, Color.rgb(41, 121, 255))
        drawPaymentRow(posTitle, puntoVentaUsd, puntoVentaBs, Color.rgb(255, 171, 0))

        currentY += 15f
        canvas.drawLine(40f, currentY, (width - 40).toFloat(), currentY, dividerPaint)
        currentY += 35f

        // Stats summary (Transactions count & weekly average)
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = Color.rgb(180, 195, 210)
        textPaint.textSize = 22f
        textPaint.typeface = Typeface.DEFAULT
        val countLabel = if (isEs) "Transacciones registradas:" else "Recorded transactions:"
        canvas.drawText(countLabel, 50f, currentY, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        textPaint.color = Color.WHITE
        textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        canvas.drawText("$salesCount", (width - 50).toFloat(), currentY, textPaint)
        currentY += 40f

        if (weeklyAverageUsd != null && weeklyAverageBs != null) {
            textPaint.textAlign = Paint.Align.LEFT
            textPaint.color = Color.rgb(180, 195, 210)
            textPaint.textSize = 22f
            textPaint.typeface = Typeface.DEFAULT
            val avgLabel = if (isEs) "Promedio Semanal Calculado:" else "Calculated Weekly Average:"
            canvas.drawText(avgLabel, 50f, currentY, textPaint)

            textPaint.textAlign = Paint.Align.RIGHT
            textPaint.color = Color.rgb(0, 230, 118)
            textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            canvas.drawText("${CurrencyUtils.formatUsd(weeklyAverageUsd)} / ${CurrencyUtils.formatBs(weeklyAverageBs)}", (width - 50).toFloat(), currentY, textPaint)
            currentY += 40f
        }

        currentY += 30f
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.rgb(130, 140, 155)
        textPaint.textSize = 18f
        textPaint.typeface = Typeface.DEFAULT
        val footerSystem = if (isEs) "Reporte oficial de ventas al detal generado en el dispositivo" else "Official retail sales report generated on device"
        canvas.drawText(footerSystem, width / 2f, currentY, textPaint)

        return bitmap
    }
}

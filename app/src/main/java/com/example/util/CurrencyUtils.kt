package com.example.util

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CurrencyUtils {
    private val usdSymbols = DecimalFormatSymbols(Locale.US).apply {
        decimalSeparator = '.'
        groupingSeparator = ','
    }
    private val usdFormat = DecimalFormat("$#,##0.00", usdSymbols)

    private val bsSymbols = DecimalFormatSymbols(Locale("es", "VE")).apply {
        decimalSeparator = ','
        groupingSeparator = '.'
    }
    private val bsFormat = DecimalFormat("Bs. #,##0.00", bsSymbols)

    fun formatUsd(amount: Double): String = usdFormat.format(amount)

    fun formatBs(amount: Double): String = bsFormat.format(amount)

    fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy hh:mm a", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }

    fun formatDateShort(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }

    fun formatTime(timestamp: Long): String {
        val sdf = SimpleDateFormat("hh:mm a", Locale.getDefault())
        return sdf.format(Date(timestamp))
    }

    fun isSameDay(t1: Long, t2: Long): Boolean {
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return sdf.format(Date(t1)) == sdf.format(Date(t2))
    }
}

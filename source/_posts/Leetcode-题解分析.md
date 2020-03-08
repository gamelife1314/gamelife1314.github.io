---
title: Leetcode 刷题开始
mathjax: true
date: 2020-03-08 20:54:33
tags:
    - LeetCode
---

{% cq %}看到公司的各种考试，我有点怕，不好好刷题就会被淘汰，为了养家糊口，我要好好学习。{% endcq %}

{% asset_img cover.png cover %}

<!-- more -->


### 动态规划

动态规划（英语：Dynamic programming，简称 DP）是一种在数学、管理科学、计算机科学、经济学和生物信息学中使用的，通过把原问题分解为相对简单的子问题的方式求解复杂问题的方法。

动态规划常常适用于有重叠子问题和最优子结构性质的问题，动态规划方法所耗时间往往远少于朴素解法。

动态规划背后的基本思想非常简单。大致上，若要解一个给定问题，我们需要解其不同部分（即子问题），再根据子问题的解以得出原问题的解。动态规划往往用于优化递归问题，例如斐波那契数列，如果运用递归的方式来求解会重复计算很多相同的子问题，利用动态规划的思想可以减少计算量。

通常许多子问题非常相似，为此动态规划法试图仅仅解决每个子问题一次，具有天然剪枝的功能，从而减少计算量：一旦某个给定子问题的解已经算出，则将其记忆化存储，以便下次需要同一个子问题解之时直接查表。这种做法在重复子问题的数目关于输入的规模呈指数增长时特别有用。

#### 最长回文字符串

题目链接：[https://leetcode-cn.com/problems/longest-palindromic-substring/](https://leetcode-cn.com/problems/longest-palindromic-substring/)，求最长回文子串。

分析，对于一个字符串 “ababa” ，如果已经知道 “bab” 是回文，那么 “ababa” 一定是回文，因为它的左首字母和右尾字母是相同的。所以我们给出状态转移方程定义：

$$\begin{equation} \label{longestPalindrome}
dp(i,j)=\left\{
\begin{aligned}
true  &   & 如果 S_i ... S_j 是回文字符串 \\
false &   & 其他情况
\end{aligned}
\right.
\end{equation}$$


所以，就有

$$\begin{equation}
dp(i,j) = (dp(i + 1, j - 1) \ \  and \ \   S_i == S_j)
\end{equation}$$

这样，我们就从一个字母的回文开始找，一直找到最长的回文字符串。我们分析下复杂度：

- 时间复杂度：$\mathcal{O}(n^2)$
- 空间复杂度：$\mathcal{O}(n^2)$，需要一个二维数组来存储

我们用 `dp[i][j]` 表示 $S_i...S_j$ 是否是回文子串，我们再分析状态转移方程，就能得出：

- `i <= j`，因此只需要二维数组的上班部分
- 因为存在 `dp[i+1][j-1]`，我们就要考虑边界

边界条件是：表达式 `[i + 1, j - 1]` 不构成区间，即长度严格小于 `2`，即 `j - 1 - (i + 1) + 1 < 2` ，整理得 `j - i < 3`。

这个结论很显然：当子串 `s[i, j]` 的长度等于 `2` 或者等于 `3` 的时候，我其实只需要判断一下头尾两个字符是否相等就可以直接下结论了。

如果子串 `s[i + 1, j - 1]` 只有 `1` 个字符，即去掉两头，剩下中间部分只有 `1` 个字符，当然是回文；
如果子串 `s[i + 1, j - 1]` 为空串，那么子串 `s[i, j]` 一定是回文子串。
因此，在 `s[i] == s[j]` 成立和 `j - i < 3` 的前提下，直接可以下结论，`dp[i][j] = true`，否则才执行状态转移。


```go
package main

import "fmt"

func longestPalindrome(s string) string {
	if len(s) < 2 {
		return s
	}
	strLen := len(s)
	var dp  = make([][]bool, strLen)
	for i := 0; i < strLen; i ++ {
		dp[i] = make([]bool, strLen)
		dp[i][i] = true
	}
	start := 0
	maxLen := 1
	for j := 1; j < strLen; j ++ {
		for i :=0;i < strLen; i ++ {
			if s[i] == s[j] {
				if j - i < 3 {
					dp[i][j] = true
				} else {
					dp[i][j] = dp[i+1][j-1]
				}
			} else {
				dp[i][j] = false
			}
			if dp[i][j] {
				curMaxLen := j - i + 1
				if curMaxLen > maxLen {
					maxLen = curMaxLen
					start = i
				}
			}
		}
	}
	return s[start:start+maxLen]
}

func main() {
	fmt.Println(longestPalindrome("cbbd"))
}

```